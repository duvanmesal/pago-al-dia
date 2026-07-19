package com.duvan.pagoaldia;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeWidget")
public class NativeWidgetPlugin extends Plugin {
    static final String PREFS = "pago_al_dia_widget";
    static final String TODAY_DATE = "today_date";
    static final String TODAY_WORKED_MINUTES = "today_worked_minutes";
    static final String HAS_TODAY_ENTRY = "has_today_entry";
    static final String WEEK_WORKED_MINUTES = "week_worked_minutes";
    static final String MONTH_NET_AMOUNT = "month_net_amount";
    static final String PAYMENT_DATE_LABEL = "payment_date_label";
    static final String SHOW_AMOUNTS = "show_amounts";
    static final String LAST_UPDATED_AT = "last_updated_at";

    @PluginMethod
    public void updateWidget(PluginCall call) {
        JSObject data = call.getData();
        prefs().edit()
            .putString(TODAY_DATE, data.optString("todayDate", ""))
            .putInt(TODAY_WORKED_MINUTES, data.optInt("todayWorkedMinutes", 0))
            .putBoolean(HAS_TODAY_ENTRY, data.optBoolean("hasTodayEntry", false))
            .putInt(WEEK_WORKED_MINUTES, data.optInt("weekWorkedMinutes", 0))
            .putFloat(MONTH_NET_AMOUNT, (float) data.optDouble("monthNetAmount", 0.0))
            .putString(PAYMENT_DATE_LABEL, data.optString("paymentDateLabel", ""))
            .putBoolean(SHOW_AMOUNTS, data.optBoolean("showAmounts", false))
            .putString(LAST_UPDATED_AT, data.optString("lastUpdatedAt", ""))
            .apply();

        updateAllWidgets();
        call.resolve();
    }

    @PluginMethod
    public void setShowAmounts(PluginCall call) {
        boolean showAmounts = call.getBoolean("showAmounts", false);
        prefs().edit().putBoolean(SHOW_AMOUNTS, showAmounts).apply();
        updateAllWidgets();
        call.resolve();
    }

    @PluginMethod
    public void getShowAmounts(PluginCall call) {
        JSObject response = new JSObject();
        response.put("showAmounts", prefs().getBoolean(SHOW_AMOUNTS, false));
        call.resolve(response);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void updateAllWidgets() {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, PagoAlDiaWidgetProvider.class));
        PagoAlDiaWidgetProvider.updateWidgets(context, manager, ids);
    }
}
