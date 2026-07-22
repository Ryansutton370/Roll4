import { Component } from '@angular/core';
import { CombatThesaurusPicker } from '../../shared/combat-thesaurus-picker/combat-thesaurus-picker';
import { GeneratorDisclaimer } from '../../shared/generator-disclaimer/generator-disclaimer';

/**
 * The Random Generators tab's fifth page — page chrome (`<h1>`, intro,
 * disclaimer) around the shared `CombatThesaurusPicker`, which does the
 * actual category-row/count/roll/copy-any-result work. The same picker is
 * also embedded in `CombatThesaurusDialog`, opened from the run-phase "+"
 * menu for a quick roll mid-combat — see that component's doc comment.
 */
@Component({
  selector: 'app-combat-thesaurus-generator',
  imports: [CombatThesaurusPicker, GeneratorDisclaimer],
  templateUrl: './combat-thesaurus-generator.html',
  styleUrl: './combat-thesaurus-generator.css',
})
export class CombatThesaurusGenerator {}
