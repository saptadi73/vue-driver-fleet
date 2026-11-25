<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppSkeleton from './AppSkeleton.vue'

type TableColumn = {
  key: string
  label: string
}

const props = withDefaults(
  defineProps<{
    columns: TableColumn[]
    rows: Record<string, unknown>[]
    loading?: boolean
    pageSize?: number
    searchPlaceholder?: string
    groupBy?: string
  }>(),
  {
    loading: false,
    pageSize: 8,
    searchPlaceholder: 'Cari data...',
  },
)

const search = ref('')
const page = ref(1)

const filteredRows = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('id-ID')
  if (!query) return props.rows

  return props.rows.filter((row) =>
    props.columns.some((column) =>
      String(row[column.key] ?? '')
        .toLocaleLowerCase('id-ID')
        .includes(query),
    ),
  )
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredRows.value.length / props.pageSize)),
)
const visibleRows = computed(() => {
  const start = (page.value - 1) * props.pageSize
  return filteredRows.value.slice(start, start + props.pageSize)
})

function groupLabel(row: Record<string, unknown>, index: number): string {
  const key = props.groupBy
  if (!key || (index > 0 && row[key] === visibleRows.value[index - 1]?.[key])) return ''
  return String(row[key] ?? '')
}

watch([search, () => props.rows], () => {
  page.value = 1
})

watch(totalPages, (pages) => {
  if (page.value > pages) page.value = pages
})
</script>

<template>
  <div class="data-table">
    <div class="table-toolbar">
      <label class="table-search">
        <span class="sr-only">Cari dalam tabel</span>
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input v-model="search" type="search" :placeholder="searchPlaceholder" />
      </label>
      <p class="table-count">{{ filteredRows.length }} <span>hasil</span></p>
    </div>

    <div class="table-scroll" :aria-busy="loading">
      <table>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="row in 5" :key="`skeleton-${row}`" class="skeleton-row">
              <td v-for="column in columns" :key="column.key">
                <AppSkeleton :lines="1" />
              </td>
            </tr>
          </template>
          <template v-else>
            <template v-for="(row, rowIndex) in visibleRows" :key="String(row.id ?? rowIndex)">
              <tr v-if="groupLabel(row, rowIndex)" class="trip-group-row">
                <td :colspan="columns.length"><strong>{{ groupLabel(row, rowIndex) }}</strong></td>
              </tr>
              <tr>
                <td v-for="column in columns" :key="column.key">
                  <slot :name="`cell-${column.key}`" :row="row">
                    {{ row[column.key] ?? '—' }}
                  </slot>
                </td>
              </tr>
            </template>
          </template>
          <tr v-if="!loading && !visibleRows.length">
            <td class="table-empty" :colspan="columns.length">Tidak ada data yang cocok.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="table-pagination">
      <span>
        Menampilkan {{ filteredRows.length ? (page - 1) * pageSize + 1 : 0 }}–{{
          Math.min(page * pageSize, filteredRows.length)
        }}
        dari {{ filteredRows.length }}
      </span>
      <div class="pagination-actions">
        <button type="button" :disabled="page <= 1 || loading" @click="page--">Sebelumnya</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button type="button" :disabled="page >= totalPages || loading" @click="page++">
          Berikutnya
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.trip-group-row td {
  background: #eef6f1;
  color: #24503c;
}
</style>
