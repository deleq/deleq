// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {DeleqMandateGuard} from "../src/DeleqMandateGuard.sol";
import {DeleqLimitMath as M} from "../src/DeleqLimitMath.sol";

interface IForkERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function allowance(address, address) external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
}

interface IForkWETH is IForkERC20 {
    function deposit() external payable;
}

interface IForkV3Factory {
    function getPool(address, address, uint24) external view returns (address);
}

/// @notice Runs against a fork of Robinhood Chain mainnet (chain id 4663):
///   forge test --match-contract Fork --fork-url <rpc> --evm-version cancun
/// Uses the real WETH, USDG and Uniswap v3 SwapRouter02 (addresses read on chain 24 Nov 2026).
contract DeleqForkTest is Test {
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address constant V3_FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;

    DeleqMandateGuard g;
    address owner = makeAddr("deleq-owner");
    address agent = makeAddr("deleq-agent");
    address shop = makeAddr("deleq-shop");
    uint24 fee;

    function setUp() public {
        if (block.chainid != 4663) vm.skip(true);
        g = new DeleqMandateGuard();
        vm.deal(owner, 10 ether);
        vm.startPrank(owner);
        IForkWETH(WETH).deposit{value: 5 ether}();
        IForkERC20(WETH).approve(address(g), type(uint256).max);
        IForkERC20(USDG).approve(address(g), type(uint256).max);
        vm.stopPrank();
        uint24[4] memory fees = [uint24(100), 500, 3000, 10000];
        for (uint256 i; i < 4; ++i) {
            address pool = IForkV3Factory(V3_FACTORY).getPool(WETH, USDG, fees[i]);
            if (pool != address(0) && IForkERC20(WETH).balanceOf(pool) > 1 ether) {
                fee = fees[i];
                break;
            }
        }
        require(fee != 0, "no WETH/USDG v3 pool with depth");
    }

    function _mandate() internal returns (uint256 id) {
        DeleqMandateGuard.MandateInit memory i;
        i.agent = agent;
        i.expiry = uint64(block.timestamp + 7 days);
        i.tokens = new DeleqMandateGuard.TokenInit[](2);
        i.tokens[0] = DeleqMandateGuard.TokenInit(WETH, 0.5 ether, 1 ether);
        i.tokens[1] = DeleqMandateGuard.TokenInit(USDG, 100e6, 300e6);
        i.recipients = new address[](1);
        i.recipients[0] = shop;
        i.routers = new address[](1);
        i.routers[0] = ROUTER;
        vm.prank(owner);
        id = g.createMandate(i);
    }

    function _order(uint256 amountIn, uint256 minOut) internal view returns (DeleqMandateGuard.SwapOrder memory) {
        return DeleqMandateGuard.SwapOrder(ROUTER, WETH, USDG, fee, amountIn, minOut, bytes32("fork"));
    }

    function test_fork_tokensAreWhatWeThink() public view {
        assertEq(IForkERC20(USDG).decimals(), 6);
        assertEq(keccak256(bytes(IForkERC20(USDG).symbol())), keccak256("USDG"));
        assertEq(IForkERC20(WETH).decimals(), 18);
    }

    function test_fork_swapPaysOwnerThroughRealRouter() public {
        uint256 id = _mandate();
        uint256 before = IForkERC20(USDG).balanceOf(owner);
        vm.prank(agent);
        (, uint256 out) = g.executeSwapV3(id, _order(0.1 ether, 1));
        assertGt(out, 0);
        assertEq(IForkERC20(USDG).balanceOf(owner) - before, out);
        assertEq(IForkERC20(WETH).balanceOf(address(g)), 0);
        assertEq(IForkERC20(USDG).balanceOf(address(g)), 0);
        assertEq(IForkERC20(WETH).allowance(address(g), ROUTER), 0);
        assertEq(IForkERC20(WETH).balanceOf(owner), 4.9 ether);
        emit log_named_uint("USDG out for 0.1 WETH (6 dec)", out);
        emit log_named_uint("pool fee", fee);
    }

    function test_fork_minOutTooHighReverts() public {
        uint256 id = _mandate();
        vm.prank(agent);
        vm.expectRevert(); // the router's own "Too little received"
        g.executeSwapV3(id, _order(0.1 ether, 1e15));
        assertEq(IForkERC20(WETH).balanceOf(owner), 5 ether);
    }

    function test_fork_realUsdgTransferWithinCaps() public {
        uint256 id = _mandate();
        vm.prank(agent);
        (, uint256 out) = g.executeSwapV3(id, _order(0.4 ether, 1));
        uint256 pay = out < 100e6 ? out / 2 : 100e6;
        vm.prank(agent);
        g.executeTransfer(id, USDG, shop, pay, bytes32("invoice-1"));
        assertEq(IForkERC20(USDG).balanceOf(shop), pay);
        assertEq(g.checkTransfer(id, agent, USDG, shop, 101e6) & M.R_OVER_PER_TX, M.R_OVER_PER_TX);
    }

    function test_fork_capsAndPauseOnRealTokens() public {
        uint256 id = _mandate();
        assertEq(g.checkSwap(id, agent, _order(0.6 ether, 1)), M.R_OVER_PER_TX);
        vm.startPrank(agent);
        g.executeSwapV3(id, _order(0.5 ether, 1));
        g.executeSwapV3(id, _order(0.5 ether, 1));
        vm.stopPrank();
        assertEq(g.checkSwap(id, agent, _order(0.01 ether, 1)), M.R_OVER_DAILY);
        vm.prank(owner);
        g.pause(id);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(DeleqMandateGuard.Rejected.selector, M.R_PAUSED | M.R_OVER_DAILY));
        g.executeSwapV3(id, _order(0.01 ether, 1));
    }

    function test_fork_unlistedRouterRefused() public {
        uint256 id = _mandate();
        DeleqMandateGuard.SwapOrder memory o = _order(0.1 ether, 1);
        o.router = V3_FACTORY;
        assertEq(g.checkSwap(id, agent, o), M.R_ROUTER_NOT_ALLOWED);
    }
}
