// Shared types between client and server

export interface User {
	id?: number;
	email: string;
	wallet_address: string;
	created_at: string;
}

export interface TokenBalance {
	id: string;
	address: string;
	name: string;
	symbol: string;
	balance: number;
	value: number;
}

export interface HolderBalanceResponse {
	id: string;
	address: string;
	totalValue: number;
	tokens: TokenBalance[];
}

export interface MetalHolderResponse {
	address: string;
	id?: string;
	userId?: string;
	createdAt?: string;
	updatedAt?: string;
}

export const SERVER_PORT = 3000;
export const SERVER_HOST_URI = `http://localhost:${SERVER_PORT}`;
export const CLIENT_PREVIEW_PORT = 5173;
export const CLIENT_DEV_PORT = 5174;
