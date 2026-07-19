import { inject, Injectable, signal } from '@angular/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { environment } from '../../environments/environment';
import { FirebaseService } from './firebase.service';
import { PlatformService } from './platform.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebase = inject(FirebaseService);
  private readonly platform = inject(PlatformService);

  readonly user = signal<User | null>(null);
  readonly ready = signal(false);

  private readonly configured = Object.values(environment.firebase).every(Boolean);

  constructor() {
    if (this.configured) {
      onAuthStateChanged(this.firebase.auth, (user) => {
        this.user.set(user);
        this.ready.set(true);
      });
    } else {
      this.ready.set(true);
    }
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.requireAuth(), email, password);
  }

  async registerWithEmail(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(this.requireAuth(), email, password);
  }

  async signInWithGoogle(): Promise<void> {
    if (this.platform.isNative && this.platform.isAndroid) {
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) throw { code: 'auth/missing-google-token' };
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(this.requireAuth(), credential);
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(this.requireAuth(), provider);
  }

  async signOut(): Promise<void> {
    await signOut(this.requireAuth());
  }

  getErrorMessage(error: unknown): string {
    const code = (error as { code?: string })?.code;
    const messages: Record<string, string> = {
      'auth/email-already-in-use': 'Este correo ya tiene una cuenta.',
      'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
      'auth/invalid-email': 'Escribe un correo válido.',
      'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
      'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
      'auth/missing-google-token': 'Google no devolvió un token válido. Inténtalo de nuevo.',
    };

    return messages[code ?? ''] ?? 'No fue posible completar la autenticación. Inténtalo de nuevo.';
  }

  private requireAuth() {
    if (!this.configured) {
      throw new Error('Completa la configuración de Firebase en src/environments/environment.ts.');
    }

    return this.firebase.auth;
  }
}
