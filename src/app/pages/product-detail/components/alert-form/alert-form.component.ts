import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Firestore, collection, addDoc, Timestamp } from '@angular/fire/firestore';

function minPriceValidator(minPrice: () => number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = Number(control.value);
    if (!val || isNaN(val)) return null;
    return val >= minPrice() ? { tooHigh: true } : null;
  };
}

type FormState = 'idle' | 'submitting' | 'success' | 'error';

@Component({
  selector: 'app-alert-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './alert-form.component.html',
  styleUrl: './alert-form.component.scss',
})
export class AlertFormComponent {
  readonly productId    = input.required<string>();
  readonly currentMinPrice = input.required<number>();

  private readonly fb        = inject(FormBuilder);
  private readonly firestore = inject(Firestore);

  readonly formState = signal<FormState>('idle');

  readonly form = this.fb.group({
    email:       ['', [Validators.required, Validators.email]],
    targetPrice: [null as number | null, [
      Validators.required,
      Validators.min(1),
      minPriceValidator(() => this.currentMinPrice()),
    ]],
  });

  get emailControl() { return this.form.controls['email']; }
  get priceControl() { return this.form.controls['targetPrice']; }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.formState() === 'submitting') return;

    this.formState.set('submitting');

    try {
      const alertsRef = collection(this.firestore, 'priceAlerts');
      await addDoc(alertsRef, {
        userId:      crypto.randomUUID(),
        productId:   this.productId(),
        targetPrice: this.priceControl.value!,
        email:       this.emailControl.value!.trim().toLowerCase(),
        isActive:    true,
        createdAt:   Timestamp.now(),
      });
      this.formState.set('success');
      this.form.reset();
    } catch {
      this.formState.set('error');
    }
  }

  retry(): void {
    this.formState.set('idle');
  }
}
