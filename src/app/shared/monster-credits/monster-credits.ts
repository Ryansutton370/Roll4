import { Component } from '@angular/core';
import { GeneratorDisclaimer } from '../generator-disclaimer/generator-disclaimer';

/**
 * Required attribution for the imported monster-template data (see
 * scripts/import-monsters-5e-srd.cjs / import-monsters-shadowdark.cjs),
 * plus the general Content & Generators disclaimer — split out of
 * MonsterGeneratorPanel so each host can place it at its own true page
 * bottom (below Combatants/Create-Encounter on EncounterList's builder
 * column, not sandwiched partway through the form the way it was when it
 * lived inside the panel itself). Static content, no inputs — a component
 * only so the licensing text lives in one place instead of duplicated
 * per host.
 */
@Component({
  selector: 'app-monster-credits',
  imports: [GeneratorDisclaimer],
  templateUrl: './monster-credits.html',
  styleUrl: './monster-credits.css',
})
export class MonsterCredits {}
