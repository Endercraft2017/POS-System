// Shared copy for the product site and café workspace. These are roadmap previews,
// not entitlement checks or actions that activate unfinished features.
const features = [
  ['Your café, online', 'A website made from your café details, with selectable themes and online ordering.'],
  ['Keep serving offline', 'Counter sales on one prepared register per branch, with synchronization when the connection returns.'],
  ['See the bigger picture', 'Sales trends, product performance and deeper insights into your café.'],
  ['A little help answering', 'A customer AI assistant grounded in your café information, with an included usage allowance.']
];

export function comingSoon(collapsible = false) {
  const cards = `<div class="roadmap-grid">${features.map(([title, description]) => `<article class="roadmap-card"><span class="roadmap-badge">Planned paid feature · WIP</span><h3>${title}</h3><p>${description}</p></article>`).join('')}</div>`;
  const content = `<p class="roadmap-intro">We’re building the free café essentials first. These planned paid features come later and aren’t available to activate yet.</p>${cards}<p class="fine-print roadmap-note">Additional locations and employee accounts are also planned paid options. Prices and the 14-day trial will be introduced when paid features are ready. No release date is set.</p>`;
  return collapsible
    ? `<details class="roadmap roadmap-disclosure"><summary>Coming next <span>Paid features · WIP</span></summary>${content}</details>`
    : `<section class="section wrap roadmap" id="coming-next" aria-labelledby="coming-next-title"><p class="eyebrow">SOMETHING GOOD IS BREWING</p><h2 id="coming-next-title">Free essentials first.<br><em>More possibilities later.</em></h2>${content}</section>`;
}
