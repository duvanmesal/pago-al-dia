import { inject, Injectable } from '@angular/core';
import { registerPlugin } from '@capacitor/core';
import { DashboardInsights, MonthlySummary, WeeklySummary } from '../models/payroll.models';
import { PlatformService } from './platform.service';

export interface WidgetSnapshot {
  todayDate: string;
  todayWorkedMinutes: number;
  hasTodayEntry: boolean;
  weekWorkedMinutes: number;
  monthNetAmount: number;
  paymentDateLabel: string;
  showAmounts: boolean;
  lastUpdatedAt: string;
}

interface NativeWidgetPlugin {
  updateWidget(snapshot: WidgetSnapshot): Promise<void>;
  setShowAmounts(options: { showAmounts: boolean }): Promise<void>;
  getShowAmounts(): Promise<{ showAmounts: boolean }>;
}

const NativeWidget = registerPlugin<NativeWidgetPlugin>('NativeWidget');

@Injectable({ providedIn: 'root' })
export class NativeWidgetService {
  private readonly webStorageKey = 'pago_al_dia_widget_show_amounts';
  private readonly platform = inject(PlatformService);

  createSnapshot(
    today: string,
    insights: DashboardInsights,
    currentWeek: WeeklySummary,
    summary: MonthlySummary,
    paymentDateLabel: string,
    showAmounts: boolean,
  ): WidgetSnapshot {
    return {
      todayDate: today,
      todayWorkedMinutes: insights.todayEntry?.workedMinutes ?? 0,
      hasTodayEntry: Boolean(insights.todayEntry),
      weekWorkedMinutes: currentWeek.workedMinutes,
      monthNetAmount: summary.finalNetAmount,
      paymentDateLabel,
      showAmounts,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  async updateWidget(snapshot: WidgetSnapshot): Promise<void> {
    if (!this.platform.isAndroid || !this.platform.isNative) return;
    await NativeWidget.updateWidget(snapshot);
  }

  async setShowAmounts(showAmounts: boolean): Promise<void> {
    if (!this.platform.isAndroid || !this.platform.isNative) {
      localStorage.setItem(this.webStorageKey, String(showAmounts));
      return;
    }

    await NativeWidget.setShowAmounts({ showAmounts });
  }

  async getShowAmounts(): Promise<boolean> {
    if (!this.platform.isAndroid || !this.platform.isNative) {
      return localStorage.getItem(this.webStorageKey) === 'true';
    }

    const result = await NativeWidget.getShowAmounts();
    return result.showAmounts;
  }
}
