import { HttpClient } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { SpellSource, SpellTemplate } from '../models/spell-template.model';

/**
 * Read-only access to the imported spell-template data (public/data/
 * spells-5e-srd.json, public/data/spells-shadowdark.json — see
 * scripts/import-spells-5e-srd.cjs / import-spells-shadowdark.cjs). Same
 * "fetch static JSON into a signal" shape as MonsterStore; kept as its own
 * service rather than folded into MonsterStore since spells and monsters
 * are unrelated reference data with different consumers (the Spell Lists
 * page's Browse/Generate, not the Encounter Generator).
 */
@Service()
export class SpellStore {
  private readonly http = inject(HttpClient);

  private readonly srdTemplates = toSignal(
    this.http.get<SpellTemplate[]>('data/spells-5e-srd.json').pipe(catchError(() => of([]))),
    { initialValue: [] as SpellTemplate[] },
  );

  private readonly shadowdarkTemplates = toSignal(
    this.http.get<SpellTemplate[]>('data/spells-shadowdark.json').pipe(catchError(() => of([]))),
    { initialValue: [] as SpellTemplate[] },
  );

  readonly templates = computed(() => [...this.srdTemplates(), ...this.shadowdarkTemplates()]);

  templatesForSource(source: SpellSource): SpellTemplate[] {
    return this.templates().filter((t) => t.source === source);
  }

  getTemplate(id: string): SpellTemplate | undefined {
    return this.templates().find((t) => t.id === id);
  }

  /** Distinct classes within one source, sorted — populates the Generate panel's Class <select>. */
  classesForSource(source: SpellSource): string[] {
    const classes = new Set<string>();
    for (const t of this.templatesForSource(source)) {
      for (const c of t.classes) classes.add(c);
    }
    return [...classes].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Templates of one source within an inclusive level range, optionally
   * narrowed to one class — the Generate panel's candidate pool.
   */
  templatesInLevelRange(
    source: SpellSource,
    min: number,
    max: number,
    className?: string,
  ): SpellTemplate[] {
    return this.templatesForSource(source).filter(
      (t) => t.level >= min && t.level <= max && (!className || t.classes.includes(className)),
    );
  }
}
