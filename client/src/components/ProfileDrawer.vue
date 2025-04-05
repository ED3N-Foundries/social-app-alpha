<template>
  <v-navigation-drawer
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :width="320"
    temporary
  >
    <v-list>
      <v-list-item
        prepend-avatar="@/assets/placeholder_avatar.png"
        :title="userEmail"
        :subtitle="walletAddress"
      >
        <template v-slot:append>
          <v-btn
            variant="text"
            icon="mdi-close"
            @click="$emit('update:modelValue', false)"
          ></v-btn>
        </template>
      </v-list-item>
    </v-list>

    <v-divider></v-divider>

    <v-list>
      <v-list-subheader>Token Balances</v-list-subheader>

      <v-list-item v-if="isLoadingBalance">
        <template v-slot:prepend>
          <v-progress-circular indeterminate></v-progress-circular>
        </template>
        <v-list-item-title class="ml-2">Loading balances...</v-list-item-title>
      </v-list-item>

      <template v-else-if="tokens.length > 0">
        <v-list-item>
          <v-list-item-title class="font-weight-bold">
            Total Value: ${{ totalValue.toFixed(2) }}
          </v-list-item-title>
        </v-list-item>

        <v-list-item v-for="token in tokens" :key="token.id">
          <template v-slot:prepend>
            <v-avatar color="primary" size="36">
              <span class="text-h6 text-white">{{ token.symbol.charAt(0) }}</span>
            </v-avatar>
          </template>

          <v-list-item-title>{{ token.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ token.symbol }}</v-list-item-subtitle>

          <template v-slot:append>
            <div class="d-flex flex-column align-end">
              <span>{{ token.balance.toLocaleString() }}</span>
              <span class="text-caption">${{ token.value.toFixed(2) }}</span>
            </div>
          </template>
        </v-list-item>
      </template>

      <v-list-item v-else>
        <v-list-item-title>No tokens found</v-list-item-title>
        <v-list-item-subtitle>Your wallet is empty :(</v-list-item-subtitle>
      </v-list-item>

      <v-list-item v-if="error" class="text-error">
        <v-list-item-title>{{ error }}</v-list-item-title>
      </v-list-item>

      <v-divider class="my-2"></v-divider>

      <v-list-item>
        <v-btn
          color="primary"
          block
          :loading="isDistributing"
          :disabled="isDistributing || isLoadingBalance"
          @click="distributeTestTokens"
        >
          Get Test Tokens (100)
        </v-btn>
      </v-list-item>
    </v-list>

    <template v-slot:append>
      <div class="pa-2">
        <v-btn
          block
          color="error"
          @click="logout"
        >
          Logout
        </v-btn>
      </div>
    </template>
  </v-navigation-drawer>
</template>

<script lang="ts" setup>
import { computed, defineProps, defineEmits, watch, onMounted, ref } from "vue";
import { useAppStore } from "@/stores/app";

const props = defineProps<{
	modelValue: boolean;
}>();

const emit = defineEmits(["update:modelValue"]);

const appStore = useAppStore();
const isLoadingBalance = computed(() => appStore.isLoadingBalance);
const isDistributing = ref(false);

const userEmail = computed(() => appStore.email);
const walletAddress = computed(() => appStore.walletAddress);
const tokens = computed(() => appStore.tokens);
const totalValue = computed(() => appStore.totalValue);
const error = computed(() => appStore.error);

const loadTokenBalance = async () => {
	if (props.modelValue && appStore.isLoggedIn && userEmail.value) {
		// Ensure we have the wallet address
		if (!walletAddress.value) {
			await appStore.fetchUserWallet(userEmail.value);
		}

		// Get token balances
		await appStore.fetchTokenBalance();
	}
};

watch(() => props.modelValue, loadTokenBalance);

onMounted(() => {
	if (appStore.isLoggedIn && userEmail.value) {
		appStore.fetchUserWallet(userEmail.value);
	}
});

const distributeTestTokens = async () => {
	isDistributing.value = true;
	try {
		const result = await appStore.distributeTokens(100);
		if (result.success) {
			// Show success message if needed
			console.log("Tokens distributed successfully:", result.data);
		}
	} catch (err) {
		console.error("Error distributing tokens:", err);
	} finally {
		isDistributing.value = false;
		// Refresh token balance to see updated tokens, we have to set a timeout because the transaction takes too long, so we are faking some loading time on our end.
		appStore.isLoadingBalance = true;
		setTimeout(async () => {
			await appStore.fetchTokenBalance();
			// No need to set to false here, as fetchTokenBalance automatically does that at the end of its function.
		}, 9000);
	}
};

const logout = () => {
	appStore.logout();
	emit("update:modelValue", false);
};
</script>
