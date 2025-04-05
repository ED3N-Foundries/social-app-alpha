<template>
  <v-card
    class="mx-auto"
    max-width="500"
  >
    <v-card-title class="text-center text-h5 py-4">
      Continue With Email
    </v-card-title>

    <v-card-text>
      <v-form
        v-model="emailValid"
        @submit.prevent="handleEmailAuth"
      >
        <v-text-field
          v-model="email"
          :rules="emailRules"
          label="Email"
          required
          variant="outlined"
          prepend-inner-icon="mdi-email"
          hint="Enter your email to continue"
        />

        <v-btn
          type="submit"
          block
          color="primary"
          class="mt-4"
          :disabled="!emailValid"
          :loading="isLoading"
        >
          Continue
        </v-btn>
      </v-form>
    </v-card-text>

    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      timeout="3000"
    >
      {{ snackbarText }}
    </v-snackbar>
  </v-card>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useAppStore } from "@/stores/app";
import { Routes, SERVER_HOST_URI } from "../../../server/consts";

const appStore = useAppStore();
const email = ref("");
const emailValid = ref(false);
const isLoading = ref(false);
const showSnackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref("success");

// Email validation rules
const emailRules = [
	(v: string) => !!v || "Email is required",
	(v: string) => /.+@.+\..+/.test(v) || "Email must be valid",
];

const handleEmailAuth = async () => {
	if (!emailValid.value) return;

	isLoading.value = true;
	try {
		// Call the API to login/register the user
		const response = await fetch(`${SERVER_HOST_URI}${Routes.metalLogin()}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email: email.value }),
		});

		if (!response.ok) {
			throw new Error("Authentication failed");
		}

		await response.json(); // Process response but don't store it

		// Use the Pinia store for authentication
		appStore.login(email.value);

		// Show success message
		snackbarColor.value = "success";
		snackbarText.value = "Successfully authenticated!";
		showSnackbar.value = true;
	} catch (error) {
		// Show error message
		snackbarColor.value = "error";
		snackbarText.value = "Authentication failed. Please try again.";
		showSnackbar.value = true;
		console.error("Auth error:", error);
	} finally {
		isLoading.value = false;
	}
};
</script>
