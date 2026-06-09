<script setup lang="ts">
import { computed } from 'vue'
import type { TreasureClue } from '@/types'

interface Props {
  clue: TreasureClue
  index: number
  isLocked?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLocked: false
})

const clueIcons: Record<string, string> = {
  hall: '🏛️',
  section: '🚪',
  diaryType: '📝',
  title: '📋',
  author: '👤',
  decayMethod: '✨'
}

const clueTypeNames: Record<string, string> = {
  hall: '展厅线索',
  section: '展区线索',
  diaryType: '类型线索',
  title: '标题线索',
  author: '作者线索',
  decayMethod: '效果线索'
}

const icon = computed(() => clueIcons[props.clue.type] || '🔍')
const typeName = computed(() => clueTypeNames[props.clue.type] || '线索')
</script>

<template>
  <div 
    class="clue-item p-3 rounded-lg border transition-all duration-300"
    :class="{
      'bg-gray-900/50 border-gray-700': !isLocked,
      'bg-gray-800/30 border-gray-800 opacity-50': isLocked
    }"
  >
    <div class="flex items-start gap-3">
      <div 
        class="text-2xl flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg"
        :class="isLocked ? 'bg-gray-800' : 'bg-gray-800/50'"
      >
        <span v-if="!isLocked">{{ icon }}</span>
        <span v-else>🔒</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs font-vt323 text-gray-500">
            线索 #{{ index + 1 }}
          </span>
          <span 
            class="text-xs px-2 py-0.5 rounded font-vt323"
            :class="isLocked ? 'bg-gray-800 text-gray-600' : 'bg-diary-fresh/20 text-diary-fresh'"
          >
            {{ typeName }}
          </span>
        </div>
        <p 
          class="text-sm font-vt323 leading-relaxed"
          :class="isLocked ? 'text-gray-700' : 'text-gray-300'"
        >
          <template v-if="!isLocked">
            {{ clue.hint }}
          </template>
          <template v-else>
            消耗 1 个记忆碎片解锁此线索
          </template>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.clue-item {
  @apply transition-all duration-300;
}

.clue-item:hover:not(.opacity-50) {
  @apply border-diary-fresh/50;
  box-shadow: 0 0 15px rgba(57, 255, 20, 0.1);
}
</style>
