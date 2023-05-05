// Functions initially from App.js

import { ethers } from 'ethers'
import {
    setProvider,
    setNetwork,
    setAccount 
    } from './reducers/provider'

import {
    setContracts,
    setSymbols,
    balancesLoaded        
    } from './reducers/tokens'

    import {
        setContract,
        sharesLoaded,
        swapsLoaded,
        mtokensBalancesLoaded,
        depositRequest,
        depositSuccess,
        depositFail,
        withdrawRequest,
        withdrawSuccess,
        withdrawFail,
        swapRequest,
        swapSuccess,
        swapFail        
    } from './reducers/amm'

import TOKEN_ABI from '../abis/Token.json';
import AMM_ABI from '../abis/AMM.json';
import config from '../config.json';

export const loadProvider = (dispatch) => {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    dispatch(setProvider(provider))

    return provider
}

export const loadNetwork = async (provider, dispatch) => {
    const { chainId } = await provider.getNetwork()
    dispatch(setNetwork(chainId))
    
    return chainId
}

export const loadAccount = async (dispatch) => {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    const account = ethers.utils.getAddress(accounts[0])
    dispatch(setAccount(account)) // Hook for Redux

    return account
}

// -------------------------------------------------------------------------------------------
// LOAD CONTRACTS
export const loadTokens = async (provider, chainId, dispatch) => {
    const usd = new ethers.Contract(config[chainId].usd.address, TOKEN_ABI, provider)
    const sobek = new ethers.Contract(config[chainId].sobek.address, TOKEN_ABI, provider) 

    dispatch(setContracts([usd, sobek]))
    dispatch(setSymbols([await usd.symbol(), await sobek.symbol()]))

    return [usd, sobek]

}

export const loadAMM = async (provider, chainId, dispatch) => {
    const amm = new ethers.Contract(config[chainId].amm.address, AMM_ABI, provider)    

    dispatch(setContract(amm))
    
    return amm
}


// -------------------------------------------------------------------------------------------
// LOAD BALANCES & SHARES
export const loadBalances = async (amm, tokens, account, dispatch) => {
    const balance1 = await tokens[0].balanceOf(account)
    const balance2 = await tokens[1].balanceOf(account)
    
    dispatch(balancesLoaded([
        ethers.utils.formatUnits(balance1.toString(), 'ether'),
        ethers.utils.formatUnits(balance2.toString(), 'ether')
    ]))

    const shares = await amm.shares(account)                                           
    dispatch(sharesLoaded(ethers.utils.formatUnits(shares.toString(), 'ether')))
}


// -------------------------------------------------------------------------------------------
// LOAD MARKET TOKEN BALANCES
export const loadMarketTokenBalances = async (amm, tokens, dispatch) => {
    const marketToken1Balance = await tokens[0].balanceOf(amm.address)
    const marketToken2Balance = await tokens[1].balanceOf(amm.address)

    console.log(marketToken1Balance)
    console.log(marketToken2Balance)
    
    dispatch(mtokensBalancesLoaded([
        ethers.utils.formatUnits(marketToken1Balance.toString(), 'ether'),
        ethers.utils.formatUnits(marketToken2Balance.toString(), 'ether')
    ]))

}



// -------------------------------------------------------------------------------------------
// ADD LIQUIDITY
export const addLiquidity = async (provider, amm, tokens, amounts, dispatch) => {
    try {
        dispatch(depositRequest())

        const signer = await provider.getSigner()

        let transaction    

        transaction = await tokens[0].connect(signer).approve(amm.address, amounts[0])
        await transaction.wait()

        transaction = await tokens[1].connect(signer).approve(amm.address, amounts[1])
        await transaction.wait()

        transaction = await amm.connect(signer).addLiquidity(amounts[0], amounts[1])
        await transaction.wait()

        dispatch(depositSuccess(transaction.hash))

    } catch (error) {
        dispatch(depositFail())
    }
}

// -------------------------------------------------------------------------------------------
// REMOVE LIQUIDITY
export const removeLiquidity = async (provider, amm, shares, dispatch) => {
    try {
        dispatch(withdrawRequest())

        const signer = await provider.getSigner()

        let transaction = await amm.connect(signer).removeLiquidity(shares)
        await transaction.wait()

        dispatch(withdrawSuccess(transaction.hash))

    } catch (error) {
        dispatch(withdrawFail())
    }  
}


// -------------------------------------------------------------------------------------------
// SWAP
// 2 step process - Approve then Swap

export const swap = async (provider, amm, token, symbol, amount, dispatch) => {
    try {
    // Tell Redux the user is Swapping
    dispatch(swapRequest())

    let transaction

    const signer = await provider.getSigner()

    transaction = await token.connect(signer).approve(amm.address, amount)
    await transaction.wait()

    if (symbol === "SOB") {
        transaction = await amm.connect(signer).swapToken1(amount)
    } else {
        transaction = await amm.connect(signer).swapToken2(amount)
    }

    await transaction.wait()

    // Tell redux that swap has completed
    dispatch(swapSuccess(transaction.hash))

    } catch (error) {
        dispatch(swapFail())
    }
}


// -------------------------------------------------------------------------------------------
// LOAD ALL SWAPS

export const loadAllSwaps = async (provider, amm, dispatch) => {

    // Fetch Swaps from Blockchain

    const block = await provider.getBlockNumber()

    const swapStream = await amm.queryFilter('Swap', 0, block)
    const swaps = swapStream.map(event => {
        return { hash: event.transactionHash, args: event.args }
    })
    
    dispatch(swapsLoaded(swaps))
}
