// SPDX-License-Identifier: MIT
pragma solidity ^0.8.32;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract LimitOrderExchange is EIP712 {
    using SafeERC20 for IERC20;

    struct Order {
        address seller;
        address tokenSell;
        address tokenBuy;
        uint256 amountSell;
        uint256 amountBuy;
        uint256 expiry;
        uint256 nonce;
    }

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,address tokenSell,address tokenBuy,uint256 amountSell,uint256 amountBuy,uint256 expiry,uint256 nonce)"
    );

    mapping(bytes32 => uint256) public filledAmountSell;
    mapping(address => mapping(uint256 => bool)) public canceledNonce;

    event OrderPublished(
        bytes32 indexed orderHash,
        address indexed seller,
        address indexed tokenSell,
        address tokenBuy,
        uint256 amountSell,
        uint256 amountBuy,
        uint256 expiry,
        uint256 nonce
    );

    event OrderCanceled(bytes32 indexed orderHash, address indexed seller, uint256 indexed nonce);

    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed buyer,
        uint256 fillAmountSell,
        uint256 fillAmountBuy,
        uint256 remainingAmountSell
    );

    error InvalidSeller();
    error InvalidTokenPair();
    error InvalidAmount();
    error InvalidSignature();
    error OrderExpired();
    error OrderCanceledError();
    error Overfill();
    error NonIntegralFillRatio();

    constructor() EIP712("SellOnlyLimitOrderExchange", "1") {}

    function hashOrder(Order calldata order) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.seller,
                    order.tokenSell,
                    order.tokenBuy,
                    order.amountSell,
                    order.amountBuy,
                    order.expiry,
                    order.nonce
                )
            )
        );
    }

    function publishOrder(Order calldata order, bytes calldata signature) external {
        _validateOrderCore(order);
        if (msg.sender != order.seller) revert InvalidSeller();
        _validateSignature(order, signature);

        bytes32 orderHash = hashOrder(order);

        emit OrderPublished(
            orderHash,
            order.seller,
            order.tokenSell,
            order.tokenBuy,
            order.amountSell,
            order.amountBuy,
            order.expiry,
            order.nonce
        );
    }

    function cancelOrder(Order calldata order) external {
        if (msg.sender != order.seller) revert InvalidSeller();
        canceledNonce[msg.sender][order.nonce] = true;

        emit OrderCanceled(hashOrder(order), msg.sender, order.nonce);
    }

    function fillOrder(
        Order calldata order,
        bytes calldata signature,
        uint256 fillAmountSell
    ) external returns (uint256 fillAmountBuy) {
        fillAmountBuy = _fillOrder(order, signature, fillAmountSell, msg.sender);
    }

    function fillOrders(
        Order[] calldata orders,
        bytes[] calldata signatures,
        uint256[] calldata fillAmountSellList
    ) external {
        uint256 length = orders.length;
        if (length != signatures.length || length != fillAmountSellList.length) revert InvalidAmount();

        for (uint256 i = 0; i < length; ) {
            _fillOrder(orders[i], signatures[i], fillAmountSellList[i], msg.sender);
            unchecked {
                i++;
            }
        }
    }

    function remainingAmountSell(Order calldata order) external view returns (uint256) {
        bytes32 orderHash = hashOrder(order);
        uint256 filled = filledAmountSell[orderHash];
        if (filled >= order.amountSell) return 0;
        return order.amountSell - filled;
    }

    function isFillable(
        Order calldata order,
        bytes calldata signature,
        uint256 fillAmountSell,
        address buyer
    ) external view returns (bool) {
        bytes32 orderHash = hashOrder(order);

        if (!_isOrderCoreValid(order)) return false;
        if (!_isSignatureValid(orderHash, order.seller, signature)) return false;
        if (canceledNonce[order.seller][order.nonce]) return false;
        if (order.expiry <= block.timestamp) return false;

        uint256 filled = filledAmountSell[orderHash];
        if (filled >= order.amountSell) return false;

        uint256 remaining = order.amountSell - filled;
        if (fillAmountSell == 0 || fillAmountSell > remaining) return false;
        if ((fillAmountSell * order.amountBuy) % order.amountSell != 0) return false;

        uint256 fillAmountBuy = (fillAmountSell * order.amountBuy) / order.amountSell;

        if (IERC20(order.tokenSell).allowance(order.seller, address(this)) < fillAmountSell) return false;
        if (IERC20(order.tokenSell).balanceOf(order.seller) < fillAmountSell) return false;

        if (buyer != address(0)) {
            if (IERC20(order.tokenBuy).allowance(buyer, address(this)) < fillAmountBuy) return false;
            if (IERC20(order.tokenBuy).balanceOf(buyer) < fillAmountBuy) return false;
        }

        return true;
    }

    function _fillOrder(
        Order calldata order,
        bytes calldata signature,
        uint256 fillAmountSell,
        address buyer
    ) internal returns (uint256 fillAmountBuy) {
        _validateOrderCore(order);

        bytes32 orderHash = hashOrder(order);

        _validateSignature(order, signature);

        if (canceledNonce[order.seller][order.nonce]) revert OrderCanceledError();
        if (order.expiry <= block.timestamp) revert OrderExpired();

        uint256 filled = filledAmountSell[orderHash];
        if (filled >= order.amountSell) revert Overfill();

        uint256 remaining = order.amountSell - filled;
        if (fillAmountSell == 0 || fillAmountSell > remaining) revert Overfill();

        if ((fillAmountSell * order.amountBuy) % order.amountSell != 0) {
            revert NonIntegralFillRatio();
        }

        fillAmountBuy = (fillAmountSell * order.amountBuy) / order.amountSell;

        filledAmountSell[orderHash] = filled + fillAmountSell;

        IERC20(order.tokenSell).safeTransferFrom(order.seller, buyer, fillAmountSell);
        IERC20(order.tokenBuy).safeTransferFrom(buyer, order.seller, fillAmountBuy);

        emit OrderFilled(orderHash, buyer, fillAmountSell, fillAmountBuy, order.amountSell - filledAmountSell[orderHash]);
    }

    function _validateOrderCore(Order calldata order) internal pure {
        if (order.seller == address(0)) revert InvalidSeller();
        if (order.tokenSell == address(0) || order.tokenBuy == address(0) || order.tokenSell == order.tokenBuy) {
            revert InvalidTokenPair();
        }
        if (order.amountSell == 0 || order.amountBuy == 0) revert InvalidAmount();
    }

    function _isOrderCoreValid(Order calldata order) internal pure returns (bool) {
        if (order.seller == address(0)) return false;
        if (order.tokenSell == address(0) || order.tokenBuy == address(0)) return false;
        if (order.tokenSell == order.tokenBuy) return false;
        if (order.amountSell == 0 || order.amountBuy == 0) return false;
        return true;
    }

    function _validateSignature(Order calldata order, bytes calldata signature) internal view {
        bytes32 orderHash = hashOrder(order);
        if (!_isSignatureValid(orderHash, order.seller, signature)) {
            revert InvalidSignature();
        }
    }

    function _isSignatureValid(bytes32 orderHash, address signer, bytes calldata signature) internal pure returns (bool) {
        address recovered = ECDSA.recover(orderHash, signature);
        return recovered == signer;
    }
}
