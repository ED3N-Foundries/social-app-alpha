import { defineStore } from "pinia";

export const useAppStore = defineStore("app", {
	state: () => ({
		appName: "ED3Nsocial",
		isAuthenticated: false,
		email: "",
	}),

	actions: {
		login(email: string) {
			this.isAuthenticated = true;
			this.email = email;
			// In a real app, you would handle API calls here
		},

		signup(email: string) {
			this.isAuthenticated = true;
			this.email = email;
			// In a real app, you would handle API calls here
		},

		logout() {
			this.isAuthenticated = false;
			this.email = "";
			// In a real app, you would handle API calls here
		},
	},

	getters: {
		userEmail: (state) => state.email,
		isLoggedIn: (state) => state.isAuthenticated,
	},
});
