import { Component } from '@angular/core';

/**
 * A short, general-purpose disclaimer shown at the bottom of every Random
 * Generators page (Names, Encounter, Wild Magic, Treasure) — separate from
 * any page-specific attribution (the Encounter page's OGL/CC BY-SA
 * notices, the Wild Magic page's source credit). Static content, no
 * inputs — a component only so the same wording/styling lives in one
 * place instead of copy-pasted across four page templates.
 */
@Component({
  selector: 'app-generator-disclaimer',
  templateUrl: './generator-disclaimer.html',
  styleUrl: './generator-disclaimer.css',
})
export class GeneratorDisclaimer {}
