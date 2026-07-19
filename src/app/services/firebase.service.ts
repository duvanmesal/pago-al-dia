import { Injectable } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private readonly app = getApps().length ? getApp() : initializeApp(environment.firebase);
  readonly auth = getAuth(this.app);
  readonly firestore = getFirestore(this.app);
}
