<template>
  <v-container>
    <v-row justify="center">
      <v-col
        cols="12"
        md="8"
      >
        <v-card class="mx-auto mt-5">
          <v-card-title class="text-h5">
            Welcome to {{ appStore.appName }}
          </v-card-title>
          <v-card-text>
            <p class="text-body-1" v-if="appStore.isLoggedIn">
              You have successfully authenticated as <strong>{{ appStore.userEmail }}</strong>.
            </p>
            <p class="text-body-1" v-else>
              This is your dashboard page.
            </p>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              color="error"
              class="mr-3"
              @click="logout"
              v-if="appStore.isLoggedIn"
            >
              Logout
            </v-btn>
            <v-btn
              color="primary"
              @click="goHome"
            >
              Go to Home Page
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
import { useRouter } from "vue-router/auto";
import { useAppStore } from "@/stores/app";

const router = useRouter();
const appStore = useAppStore();

const goHome = () => {
	router.push("/");
};

const logout = () => {
	appStore.logout();
	router.push("/");
};
</script>
