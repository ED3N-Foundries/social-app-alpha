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
import { useRouter } from "vue-router/auto";
import { useAppStore } from "@/stores/app";

const router = useRouter();
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
		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Use the Pinia store for authentication
		// This will either login or create an account if it doesn't exist
		appStore.login(email.value);

		// Redirect to dashboard on success
		router.push("/dashboard");
	} catch {
		// Show error message
		snackbarColor.value = "error";
		snackbarText.value = "Authentication failed. Please try again.";
		showSnackbar.value = true;
	} finally {
		isLoading.value = false;
	}
};
</script>
