import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Filler,
  Tooltip,
  Legend,
  type ChartDataset,
  type TooltipItem,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { PriceHistory, Store } from '../../../../core/models';
import { ClpPipe } from '../../../../shared/pipes/clp.pipe';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Filler, Tooltip, Legend);

type DaysOption = 30 | 60 | 90;

/** Distinct palette for up to 8 stores */
const STORE_COLORS = [
  '#00D4AA',
  '#FF6B6B',
  '#74C0FC',
  '#FFA94D',
  '#A9E34B',
  '#DA77F2',
  '#63E6BE',
  '#F06595',
];

@Component({
  selector: 'app-price-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="price-chart">
      <div class="price-chart__header">
        <h2 class="price-chart__title">Historial de precios</h2>
        <div class="price-chart__tabs" role="group" aria-label="Período del historial">
          @for (opt of daysOptions; track opt) {
            <button
              class="price-chart__tab"
              [class.price-chart__tab--active]="selectedDays() === opt"
              (click)="setDays(opt)"
              [attr.aria-pressed]="selectedDays() === opt"
            >
              {{ opt }}d
            </button>
          }
        </div>
      </div>
      @if (filteredHistory().length === 0) {
        <p class="price-chart__empty">Aún no hay suficiente historial para este período. Los precios se registran cada 6 horas.</p>
      } @else {
        <div class="price-chart__canvas-wrap">
          <canvas #chartCanvas aria-label="Gráfico de historial de precios" role="img"></canvas>
        </div>
      }
    </div>
  `,
  styleUrl: './price-chart.component.scss',
})
export class PriceChartComponent implements AfterViewInit, OnDestroy {
  readonly history = input.required<PriceHistory[]>();
  readonly stores  = input<Store[]>([]);

  readonly daysOptions: DaysOption[] = [30, 60, 90];
  readonly selectedDays = signal<DaysOption>(30);

  readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private chart: Chart | null = null;
  private viewReady = false;
  private clpPipe   = new ClpPipe();

  readonly filteredHistory = computed(() => {
    const cutoff = Date.now() - this.selectedDays() * 24 * 60 * 60 * 1000;
    return this.history()
      .filter(h => new Date(h.recordedAt).getTime() >= cutoff)
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  });

  /** History grouped by storeId, in insertion order. */
  private readonly byStore = computed(() => {
    const grouped = new Map<string, PriceHistory[]>();
    for (const h of this.filteredHistory()) {
      const arr = grouped.get(h.storeId) ?? [];
      arr.push(h);
      grouped.set(h.storeId, arr);
    }
    return grouped;
  });

  constructor() {
    // Re-render whenever filtered data changes (input signal or period change)
    effect(() => {
      void this.byStore(); // track dependency
      if (this.viewReady) this.renderChart();
    });
  }

  setDays(d: DaysOption): void {
    this.selectedDays.set(d);
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private storeName(storeId: string): string {
    return this.stores().find(s => s.id === storeId)?.name ?? storeId;
  }

  private renderChart(): void {
    const grouped = this.byStore();
    if (grouped.size === 0) {
      this.chart?.destroy();
      this.chart = null;
      return;
    }

    const canvas = this.chartCanvas()?.nativeElement;
    if (!canvas) return;

    const multiStore = grouped.size > 1;
    const clpPipe   = this.clpPipe;
    const storeIds  = [...grouped.keys()];

    const datasets: ChartDataset<'line'>[] = storeIds.map((storeId, i) => {
      const points   = grouped.get(storeId)!;
      const color    = STORE_COLORS[i % STORE_COLORS.length];
      return {
        label: this.storeName(storeId),
        data: points.map(h => ({ x: new Date(h.recordedAt) as unknown as number, y: h.price })),
        borderColor: color,
        backgroundColor: multiStore ? 'transparent' : `${color}14`,
        fill:         !multiStore,
        tension:      0.3,
        pointRadius:  4,
        pointHoverRadius: 7,
        pointBackgroundColor: color,
        borderWidth: 2,
      };
    });

    const tooltipLabel = (ctx: TooltipItem<'line'>): string => {
      const storePart = multiStore ? `${ctx.dataset.label ?? ''}: ` : '';
      return `${storePart}${clpPipe.transform(ctx.parsed.y ?? 0)}`;
    };

    if (this.chart) {
      this.chart.data.datasets = datasets;
      this.chart.options.plugins!.legend!.display = multiStore;
      this.chart.update();
      return;
    }

    this.chart = new Chart(canvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        plugins: {
          tooltip: {
            callbacks: { label: tooltipLabel },
          },
          legend: {
            display: multiStore,
            labels: { color: '#8B8FA8', boxWidth: 12, padding: 12 },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'day', tooltipFormat: 'dd MMM yyyy' },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#8B8FA8', maxTicksLimit: 8 },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#8B8FA8',
              callback: (val: number | string) => clpPipe.transform(Number(val)),
            },
          },
        },
      },
    });
  }
}
