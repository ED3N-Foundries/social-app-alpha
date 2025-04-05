<template>
  <v-container>
    <v-row justify="center" align="center" style="min-height: 80vh;">
      <v-col cols="12" sm="8" md="6">
        <h1 class="text-center mb-6">Welcome to {{ appStore.appName }}</h1>
        <AuthCard />
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
import AuthCard from "@/components/AuthCard.vue";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
</script>
