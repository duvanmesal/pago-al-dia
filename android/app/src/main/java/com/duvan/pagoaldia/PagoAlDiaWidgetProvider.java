package com.duvan.pagoaldia;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import java.util.Locale;

public class PagoAlDiaWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        updateWidgets(context, appWidgetManager, appWidgetIds);
    }

    static void updateWidgets(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(NativeWidgetPlugin.PREFS, Context.MODE_PRIVATE);

        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.pago_al_dia_widget);
            boolean hasTodayEntry = prefs.getBoolean(NativeWidgetPlugin.HAS_TODAY_ENTRY, false);
            int todayMinutes = prefs.getInt(NativeWidgetPlugin.TODAY_WORKED_MINUTES, 0);
            int weekMinutes = prefs.getInt(NativeWidgetPlugin.WEEK_WORKED_MINUTES, 0);
            boolean showAmounts = prefs.getBoolean(NativeWidgetPlugin.SHOW_AMOUNTS, false);
            float netAmount = prefs.getFloat(NativeWidgetPlugin.MONTH_NET_AMOUNT, 0f);
            String paymentDate = prefs.getString(NativeWidgetPlugin.PAYMENT_DATE_LABEL, "");

            views.setTextViewText(R.id.widget_today_status, hasTodayEntry ? formatHours(todayMinutes) : "Sin jornada hoy");
            views.setTextViewText(R.id.widget_week_hours, "Semana: " + formatHours(weekMinutes));
            views.setTextViewText(
                R.id.widget_amount,
                showAmounts ? String.format(Locale.US, "Final: %.2f PLN", netAmount) : "Pago oculto"
            );
            views.setTextViewText(R.id.widget_payment_date, paymentDate.isEmpty() ? "Pago al Día" : "Pago: " + paymentDate);

            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    private static String formatHours(int minutes) {
        int safeMinutes = Math.max(0, minutes);
        int hours = safeMinutes / 60;
        int rest = safeMinutes % 60;
        if (hours > 0 && rest > 0) return hours + "h " + rest + "m";
        if (hours > 0) return hours + "h";
        return rest + "m";
    }
}
