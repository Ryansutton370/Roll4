import { Component } from '@angular/core';
import { GeneratorDisclaimer } from '../generator-disclaimer/generator-disclaimer';

/**
 * Required attribution for the imported spell-template data (see
 * scripts/import-spells-5e-srd.cjs / import-spells-shadowdark.cjs), plus
 * the general Content & Generators disclaimer — same split-out-for-its-
 * own-page-bottom shape as MonsterCredits. Static content, no inputs.
 */
@Component({
  selector: 'app-spell-credits',
  imports: [GeneratorDisclaimer],
  templateUrl: './spell-credits.html',
  styleUrl: './spell-credits.css',
})
export class SpellCredits {}
