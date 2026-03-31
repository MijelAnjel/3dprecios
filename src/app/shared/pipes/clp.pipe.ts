import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'clp' })
export class ClpPipe implements PipeTransform {
  transform(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
