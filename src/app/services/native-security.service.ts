import { inject, Injectable } from '@angular/core';
import { registerPlugin } from '@capacitor/core';
import { PlatformService } from './platform.service';

export interface BiometricStatus {
  available: boolean;
  reason?: string;
}

interface NativeSecurityPlugin {
  getBiometricStatus(): Promise<BiometricStatus>;
  authenticate(): Promise<{ authenticated: boolean }>;
  setBiometricEnabled(options: { enabled: boolean }): Promise<void>;
  getBiometricEnabled(): Promise<{ enabled: boolean }>;
}

const NativeSecurity = registerPlugin<NativeSecurityPlugin>('NativeSecurity');

@Injectable({ providedIn: 'root' })
export class NativeSecurityService {
  private readonly webStorageKey = 'pago_al_dia_biometric_enabled';
  private readonly platform = inject(PlatformService);

  async getBiometricStatus(): Promise<BiometricStatus> {
    if (!this.platform.isAndroid || !this.platform.isNative) {
      return { available: false, reason: 'web' };
    }

    return NativeSecurity.getBiometricStatus();
  }

  async authenticate(): Promise<boolean> {
    if (!this.platform.isAndroid || !this.platform.isNative) return true;
    const result = await NativeSecurity.authenticate();
    return result.authenticated;
  }

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    if (!this.platform.isAndroid || !this.platform.isNative) {
      localStorage.setItem(this.webStorageKey, String(enabled));
      return;
    }

    await NativeSecurity.setBiometricEnabled({ enabled });
  }

  async getBiometricEnabled(): Promise<boolean> {
    if (!this.platform.isAndroid || !this.platform.isNative) {
      return localStorage.getItem(this.webStorageKey) === 'true';
    }

    const result = await NativeSecurity.getBiometricEnabled();
    return result.enabled;
  }
}
