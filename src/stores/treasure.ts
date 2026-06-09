import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TreasureHunt, TreasureHuntProgress, TreasureClue, Diary, GalleryHall } from '@/types'
import { TreasureHuntState as THS } from '@/types'
import { storage } from '@/utils/storage'
import { generateId } from '@/utils/id'
import { useDiaryStore } from './diary'
import { useInventoryStore } from './inventory'
import { useUserStore } from './user'
import { globalTimeline } from '@/engine/Timeline'

let _diaryStore: any = null
let _inventoryStore: any = null
let _userStore: any = null

const getDiaryStore = () => {
  if (!_diaryStore) {
    _diaryStore = useDiaryStore()
  }
  return _diaryStore
}

const getInventoryStore = () => {
  if (!_inventoryStore) {
    _inventoryStore = useInventoryStore()
  }
  return _inventoryStore
}

const getUserStore = () => {
  if (!_userStore) {
    _userStore = useUserStore()
  }
  return _userStore
}

const HINT_UNLOCK_COST = 10
const MAX_ACTIVE_HUNTS = 3

export const useTreasureStore = defineStore('treasure', () => {
  const hunts = ref<TreasureHunt[]>([])
  const progress = ref<TreasureHuntProgress>({
    currentHuntId: null,
    completedHuntIds: [],
    totalRewardsClaimed: 0,
    lastHuntTime: null
  })

  const availableHunts = computed(() => {
    return hunts.value.filter(h => h.state === THS.AVAILABLE)
  })

  const activeHunts = computed(() => {
    return hunts.value.filter(h => h.state === THS.IN_PROGRESS)
  })

  const completedHunts = computed(() => {
    return hunts.value.filter(h => h.state === THS.COMPLETED || h.state === THS.CLAIMED)
  })

  const currentHunt = computed(() => {
    if (!progress.value.currentHuntId) return null
    return hunts.value.find(h => h.id === progress.value.currentHuntId) || null
  })

  function init(userId: string) {
    hunts.value = storage.getTreasureHunts(userId)
    progress.value = storage.getTreasureProgress(userId)

    if (hunts.value.length === 0) {
      generateInitialHunts()
    }
  }

  function save(userId: string) {
    storage.saveTreasureHunts(userId, hunts.value)
    storage.saveTreasureProgress(userId, progress.value)
  }

  function getCurrentUserId(): string {
    const userStore = getUserStore()
    return userStore.currentUserId || 'default'
  }

  function generateCluesForDiary(diary: Diary, halls: GalleryHall[]): TreasureClue[] {
    const clues: TreasureClue[] = []
    const userStore = getUserStore()
    const author = userStore.getUserById(diary.ownerId)

    clues.push({
      id: generateId(),
      type: 'title',
      hint: `日记标题中包含：${diary.title.substring(0, Math.ceil(diary.title.length / 3))}...`,
      value: diary.title
    })

    clues.push({
      id: generateId(),
      type: 'author',
      hint: `作者是：${author?.name || '神秘人'}`,
      value: diary.ownerId
    })

    const diaryTypeNames: Record<string, string> = {
      'loveLetter': '情书',
      'nightmare': '噩梦',
      'base': '普通日记'
    }
    clues.push({
      id: generateId(),
      type: 'diaryType',
      hint: `日记类型是：${diaryTypeNames[diary.type] || diary.type}`,
      value: diary.type
    })

    for (const hall of halls) {
      for (const section of hall.sections) {
        if (section.filter(diary)) {
          clues.push({
            id: generateId(),
            type: 'hall',
            hint: `位于「${hall.name}」的「${section.name}」展区`,
            value: `${hall.id}:${section.id}`
          })
        }
      }
    }

    if (diary.pipeline.length > 0) {
      const methodNames: Record<string, string> = {
        'blur': '糊掉',
        'wave': '波浪扭',
        'garble': '乱码',
        'chroma': '色散',
        'pixelate': '像素化'
      }
      const enabledMethods = diary.pipeline.filter(p => p.enabled)
      if (enabledMethods.length > 0) {
        const methodName = methodNames[enabledMethods[0].methodId] || enabledMethods[0].methodId
        clues.push({
          id: generateId(),
          type: 'decayMethod',
          hint: `使用了「${methodName}」效果`,
          value: enabledMethods[0].methodId
        })
      }
    }

    return clues
  }

  function generateRewards(): { itemId: string; count: number }[] {
    const rewards: { itemId: string; count: number }[] = []
    const rand = Math.random()

    if (rand < 0.5) {
      rewards.push({ itemId: 'repairPatch_common', count: 2 })
    } else if (rand < 0.8) {
      rewards.push({ itemId: 'repairPatch_rare', count: 1 })
    } else {
      rewards.push({ itemId: 'repairPatch_epic', count: 1 })
    }

    if (Math.random() < 0.3) {
      rewards.push({ itemId: 'timeCrystal_common', count: 1 })
    }

    return rewards
  }

  function createHuntForDiary(diary: Diary, halls: GalleryHall[]): TreasureHunt {
    const now = globalTimeline.getTime()
    const clues = generateCluesForDiary(diary, halls)
    const rewards = generateRewards()

    return {
      id: generateId(),
      title: `寻找「${diary.title}」`,
      description: `根据线索在展厅中找到这篇日记，完成后领取修复道具奖励。`,
      icon: '🗺️',
      targetDiaryId: diary.id,
      clues,
      rewards,
      state: THS.AVAILABLE,
      startTime: now,
      endTime: now + 10000,
      completedAt: null,
      claimedAt: null,
      hintUnlocked: 2
    }
  }

  function generateInitialHunts() {
    const diaryStore = getDiaryStore()
    const publicDiaries = diaryStore.publicDiaries
    const halls = diaryStore.getGalleryHalls()

    if (publicDiaries.length === 0) {
      return
    }

    const huntCount = Math.min(5, publicDiaries.length)
    const shuffled = [...publicDiaries].sort(() => Math.random() - 0.5)

    for (let i = 0; i < huntCount; i++) {
      const diary = shuffled[i]
      const hunt = createHuntForDiary(diary, halls)
      hunts.value.push(hunt)
    }

    save(getCurrentUserId())
  }

  function hasPublicDiaries(): boolean {
    const diaryStore = getDiaryStore()
    return diaryStore.publicDiaries.length > 0
  }

  function getPublicDiaryCount(): number {
    const diaryStore = getDiaryStore()
    return diaryStore.publicDiaries.length
  }

  function generateNewHunt(recursionDepth: number = 0): TreasureHunt | null {
    if (recursionDepth > 3) {
      return null
    }

    const diaryStore = getDiaryStore()
    const publicDiaries = diaryStore.publicDiaries
    const halls = diaryStore.getGalleryHalls()

    if (publicDiaries.length === 0) {
      return null
    }

    const usedDiaryIds = hunts.value.map(h => h.targetDiaryId)
    let availableDiaries = publicDiaries.filter(d => !usedDiaryIds.includes(d.id))

    if (availableDiaries.length === 0) {
      const prevLength = hunts.value.length
      hunts.value = hunts.value.filter(h => h.state !== THS.CLAIMED)
      
      if (hunts.value.length === prevLength) {
        const allUsedIds = hunts.value.map(h => h.targetDiaryId)
        availableDiaries = publicDiaries.filter(d => !allUsedIds.includes(d.id))
        
        if (availableDiaries.length === 0) {
          const randomDiary = publicDiaries[Math.floor(Math.random() * publicDiaries.length)]
          const existingHunt = hunts.value.find(h => h.targetDiaryId === randomDiary.id)
          
          if (existingHunt && existingHunt.state === THS.AVAILABLE) {
            return existingHunt
          }
          
          if (existingHunt && existingHunt.state !== THS.IN_PROGRESS) {
            existingHunt.state = THS.AVAILABLE
            existingHunt.completedAt = null
            existingHunt.claimedAt = null
            save(getCurrentUserId())
            return existingHunt
          }
          
          return null
        }
      }
      
      return generateNewHunt(recursionDepth + 1)
    }

    const randomDiary = availableDiaries[Math.floor(Math.random() * availableDiaries.length)]
    const hunt = createHuntForDiary(randomDiary, halls)
    hunts.value.push(hunt)
    save(getCurrentUserId())

    return hunt
  }

  function startHunt(huntId: string): boolean {
    const hunt = hunts.value.find(h => h.id === huntId)
    if (!hunt || hunt.state !== THS.AVAILABLE) return false
    if (activeHunts.value.length >= MAX_ACTIVE_HUNTS) return false

    hunt.state = THS.IN_PROGRESS
    progress.value.currentHuntId = huntId
    progress.value.lastHuntTime = globalTimeline.getTime()

    save(getCurrentUserId())
    return true
  }

  function checkDiaryMatch(diaryId: string): boolean {
    const hunt = currentHunt.value
    if (!hunt || hunt.state !== THS.IN_PROGRESS) return false

    return hunt.targetDiaryId === diaryId
  }

  function completeHunt(): boolean {
    const hunt = currentHunt.value
    if (!hunt || hunt.state !== THS.IN_PROGRESS) return false

    hunt.state = THS.COMPLETED
    hunt.completedAt = globalTimeline.getTime()
    progress.value.completedHuntIds.push(hunt.id)

    save(getCurrentUserId())
    return true
  }

  function claimRewards(huntId: string): boolean {
    const hunt = hunts.value.find(h => h.id === huntId)
    if (!hunt || hunt.state !== THS.COMPLETED) return false

    const inventoryStore = getInventoryStore()
    hunt.rewards.forEach(reward => {
      inventoryStore.addItem(reward.itemId, reward.count)
    })

    hunt.state = THS.CLAIMED
    hunt.claimedAt = globalTimeline.getTime()
    progress.value.totalRewardsClaimed += hunt.rewards.reduce((sum, r) => sum + r.count, 0)

    if (progress.value.currentHuntId === huntId) {
      progress.value.currentHuntId = null
    }

    save(getCurrentUserId())
    return true
  }

  function unlockHint(huntId: string): boolean {
    const hunt = hunts.value.find(h => h.id === huntId)
    if (!hunt) return false
    if (hunt.hintUnlocked >= hunt.clues.length) return false

    const inventoryStore = getInventoryStore()
    if (!inventoryStore.removeItem('memoryFragment_common', 1)) return false

    hunt.hintUnlocked++
    save(getCurrentUserId())
    return true
  }

  function abandonHunt(huntId: string): boolean {
    const hunt = hunts.value.find(h => h.id === huntId)
    if (!hunt || hunt.state !== THS.IN_PROGRESS) return false

    hunt.state = THS.AVAILABLE
    if (progress.value.currentHuntId === huntId) {
      progress.value.currentHuntId = null
    }

    save(getCurrentUserId())
    return true
  }

  function selectHunt(huntId: string): void {
    const hunt = hunts.value.find(h => h.id === huntId)
    if (hunt && hunt.state === THS.IN_PROGRESS) {
      progress.value.currentHuntId = huntId
      save(getCurrentUserId())
    }
  }

  function getVisibleClues(hunt: TreasureHunt): TreasureClue[] {
    return hunt.clues.slice(0, hunt.hintUnlocked)
  }

  function refreshHunts(): void {
    const diaryStore = getDiaryStore()
    const publicDiaries = diaryStore.publicDiaries
    
    if (publicDiaries.length === 0) {
      return
    }

    const activeCount = activeHunts.value.length
    const availableCount = availableHunts.value.length

    if (availableCount < 2) {
      const needed = Math.min(3 - availableCount, publicDiaries.length)
      let generated = 0
      let attempts = 0
      const maxAttempts = needed * 2

      while (generated < needed && attempts < maxAttempts) {
        const result = generateNewHunt()
        if (result) {
          generated++
        }
        attempts++
      }
    }

    if (activeCount > 0 && !progress.value.currentHuntId) {
      progress.value.currentHuntId = activeHunts.value[0]?.id || null
      save(getCurrentUserId())
    }
  }

  return {
    hunts,
    progress,
    availableHunts,
    activeHunts,
    completedHunts,
    currentHunt,
    init,
    startHunt,
    checkDiaryMatch,
    completeHunt,
    claimRewards,
    unlockHint,
    abandonHunt,
    selectHunt,
    getVisibleClues,
    refreshHunts,
    generateNewHunt,
    hasPublicDiaries,
    getPublicDiaryCount,
    HINT_UNLOCK_COST,
    MAX_ACTIVE_HUNTS
  }
})
