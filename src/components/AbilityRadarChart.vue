<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import type { AbilityScores } from '@/types/report'

const props = defineProps<{
    abilityScores: AbilityScores
    height?: string
}>()

const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

function initChart() {
    if (!chartRef.value) return

    chartInstance = echarts.init(chartRef.value)

    const option: echarts.EChartsOption = {
        tooltip: {
            trigger: 'item',
        },
        radar: {
            center: ['50%', '50%'],
            radius: '65%',
            indicator: [
                { name: '技术基础', max: 100 },
                { name: '项目经验', max: 100 },
                { name: '表达能力', max: 100 },
                { name: '思维深度', max: 100 },
                { name: '全面性', max: 100 },
            ],
            axisName: {
                fontSize: 13,
                color: '#606266',
            },
            shape: 'polygon',
            splitNumber: 4,
        },
        series: [
            {
                type: 'radar',
                data: [
                    {
                        value: [
                            props.abilityScores.technicalFoundation,
                            props.abilityScores.projectExperience,
                            props.abilityScores.expressiveness,
                            props.abilityScores.depthOfThinking,
                            props.abilityScores.comprehensiveness,
                        ],
                        name: '能力评估',
                        areaStyle: {
                            color: 'rgba(64, 158, 255, 0.25)',
                        },
                        lineStyle: {
                            color: '#409eff',
                            width: 2,
                        },
                        itemStyle: {
                            color: '#409eff',
                        },
                    },
                ],
            },
        ],
    }

    chartInstance.setOption(option)
}

onMounted(() => {
    initChart()
    window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    chartInstance?.dispose()
})

function handleResize() {
    chartInstance?.resize()
}

watch(() => props.abilityScores, () => {
    if (chartInstance) {
        chartInstance.setOption({
            series: [{
                data: [{
                    value: [
                        props.abilityScores.technicalFoundation,
                        props.abilityScores.projectExperience,
                        props.abilityScores.expressiveness,
                        props.abilityScores.depthOfThinking,
                        props.abilityScores.comprehensiveness,
                    ],
                }],
            }],
        })
    }
}, { deep: true })
</script>

<template>
    <div ref="chartRef" class="radar-chart" :style="{ height: height || '320px' }" />
</template>

<style scoped>
.radar-chart {
    width: 100%;
}
</style>
