<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { useTreasureStore } from '@/stores/treasure'
import { useUserStore } from '@/stores/user'
import { useInventoryStore } from '@/stores/inventory'
import { pluginLoader } from '@/engine/PluginLoader'
import HallNavigator from '@/components/gallery/HallNavigator.vue'
import SectionIntro from '@/components/gallery/SectionIntro.vue'
import ExhibitCard from '@/components/gallery/ExhibitCard.vue'
import TreasureHuntModal from '@/components/treasure/TreasureHuntModal.vue'
import type { GalleryHall, GallerySection, Exhibit } from '@/types'

const diaryStore = useDiaryStore()
const treasureStore = useTreasureStore()
const userStore = useUserStore()
const inventoryStore = useInventoryStore()

const halls = ref<GalleryHall[]>([])
const currentHallId = ref('theme-hall')
const currentSectionId = ref('love-letters')
const isLoading = ref(true)
const showTreasureModal = ref(false)
const showSuccessAnimation = ref(false)
const successMessage = ref('')

const currentHall = computed(() => {
  return halls.value.find(h => h.id === currentHallId.value) || halls.value[0]
})

const currentSection = computed((): GallerySection | null => {
  if (!currentHall.value) return null
  return currentHall.value.sections.find(s => s.id === currentSectionId.value) || currentHall.value.sections[0] || null
})

const exhibits = computed(() => {
  if (!currentSection.value) return []
  return diaryStore.getExhibitsBySection(currentSection.value)
})

const totalExhibitCount = computed(() => {
  return diaryStore.publicDiaries.length
})

const hasActiveHunt = computed(() => {
  return treasureStore.currentHunt !== null
})

const currentHuntTitle = computed(() => {
  return treasureStore.currentHunt?.title || ''
})

async function init() {
  isLoading.value = true
  await pluginLoader.loadAll()
  halls.value = diaryStore.getGalleryHalls()
  
  if (userStore.currentUserId) {
    inventoryStore.init(userStore.currentUserId)
    treasureStore.init(userStore.currentUserId)
    treasureStore.refreshHunts()
  }
  
  if (halls.value.length > 0) {
    currentHallId.value = halls.value[0].id
    if (halls.value[0].sections.length > 0) {
      currentSectionId.value = halls.value[0].sections[0].id
    }
  }
  
  isLoading.value = false
}

function handleSelectHall(hallId: string) {
  currentHallId.value = hallId
  const hall = halls.value.find(h => h.id === hallId)
  if (hall && hall.sections.length > 0) {
    currentSectionId.value = hall.sections[0].id
  }
}

function handleSelectSection(sectionId: string) {
  currentSectionId.value = sectionId
}

function handleExhibitClick(exhibit: Exhibit, event: Event) {
  event.stopPropagation()
  
  if (hasActiveHunt.value) {
    const isMatch = treasureStore.checkDiaryMatch(exhibit.diary.id)
    if (isMatch) {
      treasureStore.completeHunt()
      showSuccess('🎉 恭喜！你找到了目标日记！快去领取奖励吧！')
      setTimeout(() => {
        showTreasureModal.value = true
      }, 1500)
      return
    }
  }
}

function openTreasureModal() {
  showTreasureModal.value = true
}

function showSuccess(message: string) {
  successMessage.value = message
  showSuccessAnimation.value = true
  setTimeout(() => {
    showSuccessAnimation.value = false
  }, 3000)
}

onMounted(() => {
  init()
})
</script>

<template>
  <div class="space-y-6">
    <div class="text-center py-8 bg-gradient-to-b from-gray-900/50 to-transparent rounded-lg relative">
      <button
        class="absolute top-4 right-4 btn-pixel bg-diary-fresh/20 border-diary-fresh text-diary-fresh px-4 py-2 font-vt323 text-sm flex items-center gap-2 hover:bg-diary-fresh/30 transition-all"
        @click="openTreasureModal"
      >
        <span class="text-lg">🗺️</span>
        <span>记忆寻宝</span>
        <span 
          v-if="treasureStore.activeHunts.length > 0"
          class="bg-diary-fresh text-black text-xs px-2 py-0.5 rounded-full"
        >
          {{ treasureStore.activeHunts.length }}
        </span>
      </button>

      <div class="text-6xl mb-4">🏛️</div>
      <h1 class="font-vt323 text-4xl text-diary-fresh glow-text mb-2">
        公开展陈馆
      </h1>
      <p class="text-gray-400 font-vt323 text-lg mb-2">
        漫步于数字腐朽的艺术殿堂，感受时间赋予的独特美学
      </p>
      <p class="text-gray-500 font-vt323 text-sm">
        目前馆内共展出 <span class="text-diary-fresh">{{ totalExhibitCount }}</span> 件公开作品
      </p>
    </div>

    <div 
      v-if="hasActiveHunt"
      class="bg-gradient-to-r from-diary-fresh/10 via-diary-fresh/5 to-diary-fresh/10 border border-diary-fresh/30 rounded-lg p-4"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="text-3xl animate-bounce">🔍</div>
          <div>
            <p class="font-vt323 text-diary-fresh text-sm">
              正在进行寻宝任务
            </p>
            <p class="font-vt323 text-white text-lg">
              {{ currentHuntTitle }}
            </p>
          </div>
        </div>
        <button
          class="btn-pixel border-diary-fresh text-diary-fresh px-4 py-2 font-vt323 text-sm"
          @click="openTreasureModal"
        >
          查看线索
        </button>
      </div>
      <p class="text-gray-400 font-vt323 text-xs mt-2">
        💡 点击展厅中的日记卡片，如果是目标日记，你将自动完成任务！
      </p>
    </div>

    <div class="ascii-divider text-gray-700">
      ================================================================================
    </div>

    <div v-if="isLoading" class="text-center py-16">
      <div class="text-4xl mb-4 animate-pulse">🎨</div>
      <p class="text-gray-500 font-vt323 text-xl">正在布置展厅...</p>
    </div>

    <template v-else>
      <HallNavigator
        :halls="halls"
        :current-hall-id="currentHallId"
        :current-section-id="currentSectionId"
        @select-hall="handleSelectHall"
        @select-section="handleSelectSection"
      />

      <SectionIntro
        :section="currentSection"
        :exhibit-count="exhibits.length"
      />

      <div v-if="exhibits.length === 0" class="text-center py-16 bg-gray-900/30 rounded-lg border border-gray-800">
        <div class="text-6xl mb-4 opacity-50">🖼️</div>
        <p class="text-gray-500 font-vt323 text-xl mb-2">
          此展区暂无展品
        </p>
        <p class="text-gray-600 font-vt323 text-sm">
          试试切换到其他展区，也许会有惊喜发现
        </p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="exhibit in exhibits"
          :key="exhibit.diary.id"
          @click="handleExhibitClick(exhibit, $event)"
        >
          <ExhibitCard
            :exhibit="exhibit"
          />
        </div>
      </div>
    </template>

    <div class="ascii-divider text-gray-700 mt-12">
      ================================================================================
    </div>

    <div class="text-center text-gray-600 font-vt323 text-sm py-4">
      <p>💡 小贴士：每篇日记都在随时间不断变化，现在看到的样子，下次再来可能就不同了</p>
    </div>

    <TreasureHuntModal 
      v-model:show="showTreasureModal"
      @close="showTreasureModal = false"
    />

    <Transition name="fade">
      <div
        v-if="showSuccessAnimation"
        class="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-diary-fresh text-black px-8 py-4 rounded-lg font-vt323 shadow-2xl"
      >
        <div class="flex items-center gap-3">
          <span class="text-3xl animate-bounce">🎉</span>
          <span class="text-lg">{{ successMessage }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
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
