import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
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
  type ChartDataset,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { PriceHistory } from '../../../../core/models';
import { ClpPipe } from '../../../../shared/pipes/clp.pipe';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Filler, Tooltip);

type DaysOption = 30 | 60 | 90;

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
        <p class="price-chart__empty">No hay historial de precios para este período.</p>
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
  readonly daysOptions: DaysOption[] = [30, 60, 90];
  readonly selectedDays = signal<DaysOption>(30);

  readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private chart: Chart | null = null;
  private clpPipe = new ClpPipe();

  readonly filteredHistory = computed(() => {
    const cutoff = Date.now() - this.selectedDays() * 24 * 60 * 60 * 1000;
    return this.history()
      .filter(h => (h.recordedAt as unknown as { toMillis(): number }).toMillis() >= cutoff)
      .sort((a, b) =>
        (a.recordedAt as unknown as { toMillis(): number }).toMillis() -
        (b.recordedAt as unknown as { toMillis(): number }).toMillis()
      );
  });

  setDays(d: DaysOption): void {
    this.selectedDays.set(d);
    this.renderChart();
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    const data = this.filteredHistory();
    if (data.length === 0) return;

    const labels = data.map(h =>
      new Date((h.recordedAt as unknown as { toMillis(): number }).toMillis())
    );
    const prices = data.map(h => h.price);

    const dataset: ChartDataset<'line'> = {
      data: prices,
      borderColor: '#00D4AA',
      backgroundColor: 'rgba(0, 212, 170, 0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: '#00D4AA',
    };

    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets = [dataset];
      this.chart.update();
      return;
    }

    const clpPipe = this.clpPipe;
    this.chart = new Chart(this.chartCanvas().nativeElement, {
      type: 'line',
      data: { labels, datasets: [dataset] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => clpPipe.transform(ctx.parsed.y ?? 0),
            },
          },
          legend: { display: false },
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
