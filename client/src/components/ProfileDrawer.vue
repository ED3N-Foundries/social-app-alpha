<template>
  <v-navigation-drawer
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :width="320"
    temporary
  >
    <v-list>
      <v-list-item
        prepend-avatar="https://randomuser.me/api/portraits/men/78.jpg"
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
      <v-list-subheader>Wallet Info</v-list-subheader>

      <v-list-item>
        <v-list-item-title class="text-body-2">ENS Name</v-list-item-title>
        <div class="d-flex align-center">
          <template v-if="isEditingEns">
            <v-text-field
              v-model="ensNameInput"
              density="compact"
              hide-details
              class="mr-2"
              :loading="isLoadingEns"
              :rules="[(v: string) => !!v || 'ENS name is required']"
            ></v-text-field>
            <v-btn
              size="small"
              color="success"
              icon="mdi-check"
              variant="text"
              @click="saveEns"
              :disabled="!ensNameInput"
              :loading="isLoadingEns"
            ></v-btn>
            <v-btn
              size="small"
              color="error"
              icon="mdi-close"
              variant="text"
              @click="cancelEnsEdit"
              :disabled="isLoadingEns"
            ></v-btn>
          </template>
          <template v-else>
            <span v-if="userEnsName" class="mr-2">{{ userEnsName }}</span>
            <span v-else class="text-grey mr-2">Set ENS name</span>
            <v-btn
              size="small"
              variant="text"
              icon="mdi-pencil"
              density="compact"
              @click="startEnsEdit"
            ></v-btn>
          </template>
        </div>
      </v-list-item>

      <v-divider></v-divider>

      <v-list-subheader>Token Balances</v-list-subheader>

      <v-list-item v-if="isLoadingBalance">
        <template v-slot:prepend>
          <v-progress-circular indeterminate></v-progress-circular>
        </template>
        <v-list-item-title>Loading balances...</v-list-item-title>
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
        <v-list-item-subtitle>Your wallet is empty</v-list-item-subtitle>
      </v-list-item>

      <v-list-item v-if="error" class="text-error">
        <v-list-item-title>{{ error }}</v-list-item-title>
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
const isLoadingEns = ref(false);
const isEditingEns = ref(false);
const ensNameInput = ref("");

const userEmail = computed(() => appStore.email);
const walletAddress = computed(() => appStore.walletAddress);
const userEnsName = computed(() => appStore.ensName);
const tokens = computed(() => appStore.tokens);
const totalValue = computed(() => appStore.totalValue);
const isLoadingBalance = computed(() => appStore.isLoadingBalance);
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

const startEnsEdit = () => {
	ensNameInput.value = userEnsName.value || "";
	isEditingEns.value = true;
};

const cancelEnsEdit = () => {
	isEditingEns.value = false;
	ensNameInput.value = "";
};

const saveEns = async () => {
	if (!ensNameInput.value) return;

	isLoadingEns.value = true;
	try {
		await appStore.updateEnsName(ensNameInput.value);
		isEditingEns.value = false;
	} finally {
		isLoadingEns.value = false;
	}
};

watch(() => props.modelValue, loadTokenBalance);

onMounted(() => {
	if (appStore.isLoggedIn && userEmail.value) {
		appStore.fetchUserWallet(userEmail.value);
	}
});

const logout = () => {
	appStore.logout();
	emit("update:modelValue", false);
};
</script>
