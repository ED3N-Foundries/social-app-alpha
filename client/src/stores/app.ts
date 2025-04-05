import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { TokenBalance } from "../../../server/server";
import { Routes, SERVER_HOST_URI } from "../../../server/consts";

export const useAppStore = defineStore("app", () => {
	// App State
	const appName = ref("ED3Nsocial");
	const isAuthenticated = ref(false);
	const email = ref("");

	// Wallet State
	const walletAddress = ref("");
	const ensName = ref("");
	const tokens = ref<TokenBalance[]>([]);
	const totalValue = ref(0);
	const isLoadingBalance = ref(false);
	const error = ref("");

	// Getters
	const userEmail = computed(() => email.value);
	const isLoggedIn = computed(() => isAuthenticated.value);
	const hasWallet = computed(() => !!walletAddress.value);
	const userEnsName = computed(() => ensName.value);

	// Auth Actions
	function login(userEmail: string) {
		isAuthenticated.value = true;
		email.value = userEmail;
		// In a real app, you would handle API calls here
	}

	function signup(userEmail: string) {
		isAuthenticated.value = true;
		email.value = userEmail;
		// In a real app, you would handle API calls here
	}

	function logout() {
		isAuthenticated.value = false;
		email.value = "";
		walletAddress.value = "";
		ensName.value = "";
		tokens.value = [];
		totalValue.value = 0;
		// In a real app, you would handle API calls here
	}

	// Wallet Actions
	async function fetchUserWallet(userEmail: string) {
		try {
			const response = await fetch(
				`${SERVER_HOST_URI}${Routes.metalUser(userEmail)}`,
			);
			if (!response.ok) throw new Error("Failed to fetch wallet");

			const data = await response.json();
			walletAddress.value = data.wallet_address;
			ensName.value = data.ens_name || "";
			return data.wallet_address;
		} catch (err) {
			console.error("Error fetching wallet:", err);
			error.value = "Failed to load wallet information";
			return null;
		}
	}

	async function fetchTokenBalance() {
		if (!email.value) return;

		isLoadingBalance.value = true;
		error.value = "";

		try {
			// We're using the backend as a proxy to the Metal API
			// The server will add the API key and handle the request
			const response = await fetch(
				`${SERVER_HOST_URI}${Routes.metalHolderBalance(email.value)}`,
			);

			if (!response.ok) throw new Error("Failed to fetch token balance");

			const data = await response.json();
			tokens.value = data.tokens || [];
			totalValue.value = data.totalValue || 0;
		} catch (err) {
			console.error("Error fetching token balance:", err);
			error.value = "Failed to load token balance";
		} finally {
			isLoadingBalance.value = false;
		}
	}

	async function updateEnsName(newEnsName: string) {
		if (!walletAddress.value) return false;

		error.value = "";

		try {
			const response = await fetch(`${SERVER_HOST_URI}${Routes.ensSetName()}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					wallet_address: walletAddress.value,
					ens_name: newEnsName,
				}),
			});

			if (!response.ok) throw new Error("Failed to update ENS name");

			const data = await response.json();
			ensName.value = data.ens_name;
			return true;
		} catch (err) {
			console.error("Error updating ENS name:", err);
			error.value = "Failed to update ENS name";
			return false;
		}
	}

	return {
		// App state
		appName,
		isAuthenticated,
		email,

		// Wallet state
		walletAddress,
		ensName,
		tokens,
		totalValue,
		isLoadingBalance,
		error,

		// Getters
		userEmail,
		isLoggedIn,
		hasWallet,
		userEnsName,

		// Auth actions
		login,
		signup,
		logout,

		// Wallet actions
		fetchUserWallet,
		fetchTokenBalance,
		updateEnsName,
	};
});
