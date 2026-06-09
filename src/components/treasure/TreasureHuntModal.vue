<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTreasureStore } from '@/stores/treasure'
import { useInventoryStore } from '@/stores/inventory'
import { pluginLoader } from '@/engine/PluginLoader'
import { TREASURE_HUNT_STATE_NAMES, TreasureHuntState as THS } from '@/types'
import type { TreasureHunt } from '@/types'
import TreasureClue from './TreasureClue.vue'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'close'): void
}>()

const treasureStore = useTreasureStore()
const inventoryStore = useInventoryStore()

const activeTab = ref<'active' | 'available' | 'completed'>('active')
const selectedHuntId = ref<string | null>(null)
const showSuccessAnimation = ref(false)
const successMessage = ref('')

const selectedHunt = computed(() => {
  if (!selectedHuntId.value) return null
  return treasureStore.hunts.find(h => h.id === selectedHuntId.value) || null
})

const tabs = computed(() => [
  { id: 'active', name: '进行中', icon: '🔍', count: treasureStore.activeHunts.length },
  { id: 'available', name: '可领取', icon: '📜', count: treasureStore.availableHunts.length },
  { id: 'completed', name: '已完成', icon: '🏆', count: treasureStore.completedHunts.length }
])

const displayHunts = computed(() => {
  switch (activeTab.value) {
    case 'active':
      return treasureStore.activeHunts
    case 'available':
      return treasureStore.availableHunts
    case 'completed':
      return treasureStore.completedHunts
    default:
      return []
  }
})

const hasMemoryFragments = computed(() => {
  return inventoryStore.getItemCount('memoryFragment_common')
})

const canUnlockMoreClues = computed(() => {
  if (!selectedHunt.value) return false
  return selectedHunt.value.hintUnlocked < selectedHunt.value.clues.length
})

const getItemInfo = (itemId: string) => {
  return pluginLoader.getItem(itemId)
}

function handleClose() {
  emit('update:show', false)
  emit('close')
}

function handleSelectHunt(hunt: TreasureHunt) {
  selectedHuntId.value = hunt.id
  if (hunt.state === THS.IN_PROGRESS) {
    treasureStore.selectHunt(hunt.id)
  }
}

function handleStartHunt(huntId: string) {
  const success = treasureStore.startHunt(huntId)
  if (success) {
    selectedHuntId.value = huntId
    showSuccess('寻宝任务已开始！快去展厅中寻找目标日记吧！')
  }
}

function handleUnlockHint(huntId: string) {
  const success = treasureStore.unlockHint(huntId)
  if (success) {
    showSuccess('线索已解锁！')
  }
}

function handleAbandonHunt(huntId: string) {
  if (confirm('确定要放弃这个寻宝任务吗？')) {
    treasureStore.abandonHunt(huntId)
    selectedHuntId.value = null
  }
}

function handleClaimRewards(huntId: string) {
  const success = treasureStore.claimRewards(huntId)
  if (success) {
    showSuccess('奖励已领取！道具已存入你的背包。')
  }
}

function showSuccess(message: string) {
  successMessage.value = message
  showSuccessAnimation.value = true
  setTimeout(() => {
    showSuccessAnimation.value = false
  }, 2000)
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
    handleClose()
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    treasureStore.refreshHunts()
    if (treasureStore.currentHunt) {
      selectedHuntId.value = treasureStore.currentHunt.id
      activeTab.value = 'active'
    }
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="show"
        class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
        @click="handleOverlayClick"
      >
        <div class="modal-content w-full max-w-4xl max-h-[90vh] bg-gray-900 rounded-lg border-2 border-gray-700 flex flex-col overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-gray-800">
            <div class="flex items-center gap-3">
              <span class="text-3xl">🗺️</span>
              <div>
                <h2 class="font-vt323 text-2xl text-diary-fresh glow-text">
                  记忆寻宝
                </h2>
                <p class="text-gray-500 font-vt323 text-sm">
                  根据线索在展厅中寻找指定日记，完成后领取修复道具奖励
                </p>
              </div>
            </div>
            <button
              class="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-800 transition-colors"
              @click="handleClose"
            >
              ✕
            </button>
          </div>

          <div class="flex border-b border-gray-800">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="flex-1 py-3 px-4 font-vt323 text-sm transition-all duration-300 flex items-center justify-center gap-2"
              :class="{
                'bg-gray-800/50 text-diary-fresh border-b-2 border-diary-fresh': activeTab === tab.id,
                'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30': activeTab !== tab.id
              }"
              @click="activeTab = tab.id as any"
            >
              <span>{{ tab.icon }}</span>
              <span>{{ tab.name }}</span>
              <span 
                v-if="tab.count > 0"
                class="px-2 py-0.5 rounded text-xs"
                :class="activeTab === tab.id ? 'bg-diary-fresh/20 text-diary-fresh' : 'bg-gray-700 text-gray-400'"
              >
                {{ tab.count }}
              </span>
            </button>
          </div>

          <div class="flex flex-1 overflow-hidden">
            <div class="w-80 border-r border-gray-800 overflow-y-auto">
              <div v-if="displayHunts.length === 0" class="p-8 text-center">
                <div class="text-4xl mb-3 opacity-50">
                  {{ activeTab === 'active' ? '🔍' : activeTab === 'available' ? '📭' : '🏆' }}
                </div>
                <p class="text-gray-500 font-vt323">
                  {{ activeTab === 'active' ? '暂无进行中的任务' : activeTab === 'available' ? '暂无可用任务' : '暂无已完成任务' }}
                </p>
              </div>
              <div v-else class="p-2">
                <div
                  v-for="hunt in displayHunts"
                  :key="hunt.id"
                  class="p-3 mb-2 rounded-lg cursor-pointer transition-all duration-300"
                  :class="{
                    'bg-gray-800/50 border border-diary-fresh/30': selectedHuntId === hunt.id,
                    'bg-gray-900/50 border border-transparent hover:bg-gray-800/30 hover:border-gray-700': selectedHuntId !== hunt.id
                  }"
                  @click="handleSelectHunt(hunt)"
                >
                  <div class="flex items-start gap-3">
                    <span class="text-2xl">{{ hunt.icon }}</span>
                    <div class="flex-1 min-w-0">
                      <h3 class="font-vt323 text-white text-sm mb-1 truncate">
                        {{ hunt.title }}
                      </h3>
                      <div class="flex items-center gap-2">
                        <span 
                          class="text-xs px-2 py-0.5 rounded font-vt323"
                          :class="{
                            'bg-green-500/20 text-green-400': hunt.state === THS.IN_PROGRESS,
                            'bg-blue-500/20 text-blue-400': hunt.state === THS.AVAILABLE,
                            'bg-yellow-500/20 text-yellow-400': hunt.state === THS.COMPLETED,
                            'bg-gray-500/20 text-gray-400': hunt.state === THS.CLAIMED
                          }"
                        >
                          {{ TREASURE_HUNT_STATE_NAMES[hunt.state] }}
                        </span>
                        <span class="text-xs text-gray-500 font-vt323">
                          {{ hunt.rewards.length }} 个奖励
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto p-4">
              <div v-if="!selectedHunt" class="h-full flex items-center justify-center">
                <div class="text-center">
                  <div class="text-5xl mb-4 opacity-30">👈</div>
                  <p class="text-gray-600 font-vt323">
                    从左侧选择一个任务查看详情
                  </p>
                </div>
              </div>

              <div v-else class="space-y-4">
                <div class="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
                  <div class="flex items-start gap-3 mb-3">
                    <span class="text-4xl">{{ selectedHunt.icon }}</span>
                    <div class="flex-1">
                      <h3 class="font-vt323 text-xl text-white mb-1">
                        {{ selectedHunt.title }}
                      </h3>
                      <p class="text-gray-400 font-vt323 text-sm">
                        {{ selectedHunt.description }}
                      </p>
                    </div>
                  </div>

                  <div class="flex flex-wrap gap-2 mb-4">
                    <span 
                      v-for="reward in selectedHunt.rewards"
                      :key="reward.itemId"
                      class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-vt323 bg-diary-fresh/10 border border-diary-fresh/30 text-diary-fresh"
                    >
                      <span>{{ getItemInfo(reward.itemId)?.icon || '🎁' }}</span>
                      <span>{{ getItemInfo(reward.itemId)?.name || reward.itemId }}</span>
                      <span class="text-gray-400">x{{ reward.count }}</span>
                    </span>
                  </div>

                  <div class="flex gap-2">
                    <template v-if="selectedHunt.state === THS.AVAILABLE">
                      <button
                        class="flex-1 btn-pixel bg-diary-fresh text-black font-vt323 text-sm py-2 px-4"
                        :disabled="treasureStore.activeHunts.length >= treasureStore.MAX_ACTIVE_HUNTS"
                        @click="handleStartHunt(selectedHunt.id)"
                      >
                        🚀 开始寻宝
                      </button>
                    </template>

                    <template v-else-if="selectedHunt.state === THS.IN_PROGRESS">
                      <button
                        class="flex-1 btn-pixel border-orange-500 text-orange-500 font-vt323 text-sm py-2 px-4"
                        @click="handleAbandonHunt(selectedHunt.id)"
                      >
                        🚪 放弃任务
                      </button>
                    </template>

                    <template v-else-if="selectedHunt.state === THS.COMPLETED">
                      <button
                        class="flex-1 btn-pixel bg-diary-fresh text-black font-vt323 text-sm py-2 px-4"
                        @click="handleClaimRewards(selectedHunt.id)"
                      >
                        🎁 领取奖励
                      </button>
                    </template>

                    <template v-else-if="selectedHunt.state === THS.CLAIMED">
                      <div class="flex-1 text-center py-2 text-gray-500 font-vt323 text-sm">
                        ✅ 奖励已领取
                      </div>
                    </template>
                  </div>
                </div>

                <div class="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="font-vt323 text-diary-fresh text-sm">
                      🔍 线索列表
                    </h4>
                    <div class="flex items-center gap-2">
                      <span class="text-gray-500 font-vt323 text-xs">
                        已解锁 {{ selectedHunt.hintUnlocked }}/{{ selectedHunt.clues.length }}
                      </span>
                      <button
                        v-if="canUnlockMoreClues"
                        class="btn-pixel text-xs py-1 px-3 border-gray-500 text-gray-300"
                        :disabled="hasMemoryFragments <= 0"
                        @click="handleUnlockHint(selectedHunt.id)"
                      >
                        💎 解锁线索 (1 记忆碎片)
                      </button>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <TreasureClue
                      v-for="(clue, index) in selectedHunt.clues"
                      :key="clue.id"
                      :clue="clue"
                      :index="index"
                      :is-locked="index >= selectedHunt.hintUnlocked"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Transition name="fade">
          <div
            v-if="showSuccessAnimation"
            class="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-diary-fresh text-black px-6 py-3 rounded-lg font-vt323 text-sm shadow-lg"
          >
            ✨ {{ successMessage }}
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95) translateY(20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>
