import { HttpClient } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { MonsterSource, MonsterTemplate } from '../models/monster-template.model';

/**
 * Read-only access to the imported monster-template data (public/data/
 * monsters-5e-srd.json, public/data/monsters-shadowdark.json — see
 * scripts/import-monsters-5e-srd.cjs / import-monsters-shadowdark.cjs).
 * Same "fetch static JSON into a signal" shape as NameTableStore; kept as
 * its own service since monster templates and name tables are unrelated
 * reference data with different consumers (the future Encounter Generator
 * and stat-block modal, vs. the Name Generator and CombatantFields).
 */
@Service()
export class MonsterStore {
  private readonly http = inject(HttpClient);

  private readonly srdTemplates = toSignal(
    this.http.get<MonsterTemplate[]>('data/monsters-5e-srd.json').pipe(catchError(() => of([]))),
    { initialValue: [] as MonsterTemplate[] },
  );

  private readonly shadowdarkTemplates = toSignal(
    this.http
      .get<MonsterTemplate[]>('data/monsters-shadowdark.json')
      .pipe(catchError(() => of([]))),
    { initialValue: [] as MonsterTemplate[] },
  );

  readonly templates = computed(() => [...this.srdTemplates(), ...this.shadowdarkTemplates()]);

  templatesForSource(source: MonsterSource): MonsterTemplate[] {
    return this.templates().filter((t) => t.source === source);
  }

  getTemplate(id: string): MonsterTemplate | undefined {
    return this.templates().find((t) => t.id === id);
  }

  /**
   * Templates of one source within an inclusive difficulty range — for the
   * (not yet built) Encounter Generator to pull candidates matching a
   * target CR/Level. A `null` difficulty (the handful of Shadowdark
   * monsters whose stats scale with context rather than having a fixed
   * value — see MonsterTemplate) never matches a range, since there's
   * nothing to compare.
   */
  templatesInDifficultyRange(source: MonsterSource, min: number, max: number): MonsterTemplate[] {
    return this.templatesForSource(source).filter(
      (t) => t.difficulty !== null && t.difficulty >= min && t.difficulty <= max,
    );
  }
}
