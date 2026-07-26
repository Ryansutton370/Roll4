import { Component } from '@angular/core';

/**
 * A simple static page — no store, no signals, nothing that changes at
 * runtime. Always the last header nav tab (see app.html/app.routes.ts).
 * The About section is a placeholder until real biographical content gets
 * written; Contact and "How it's made" are real content today.
 */
@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {}
