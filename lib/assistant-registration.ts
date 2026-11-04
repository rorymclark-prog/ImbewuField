// A source photo is evidence, not a survey. This fit records where known image controls land;
// it never moves saved design points, calibrates metres, or fills unphotographed ground.
export type RegistrationControl = { source: [number, number]; target: [number, number] };
export type AffineRegistration = { matrix: [number, number, number, number, number, number]; rmsPixels: number; maxErrorPixels: number; controls: RegistrationControl[] };
function solve(matrix: number[][], values: number[]): number[] {
  const rows = matrix.map((r, i) => [...r, values[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    if (Math.abs(rows[pivot][col]) < 1e-10) throw Error('Choose controls spread across the photograph, away from one straight line.');
    [rows[pivot], rows[col]] = [rows[col], rows[pivot]];
    const scale = rows[col][col]; for (let k = col; k < 4; k++) rows[col][k] /= scale;
    for (let row = 0; row < 3; row++) if (row !== col) { const factor = rows[row][col]; for (let k = col; k < 4; k++) rows[row][k] -= factor * rows[col][k]; }
  }
  return rows.map(r => r[3]);
}
export function fitPhotoRegistration(controls: RegistrationControl[], sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): AffineRegistration {
  if (![sourceWidth,sourceHeight,targetWidth,targetHeight].every(n => Number.isFinite(n) && n > 0 && n <= 30000) || controls.length < 3 || controls.length > 20) throw Error('Use 3–20 observed controls and valid image/frame dimensions.');
  const normal = [[0,0,0],[0,0,0],[0,0,0]], vx = [0,0,0], vy = [0,0,0];
  for (const control of controls) {
    const { source: [x,y], target: [u,v] } = control;
    if (![x,y,u,v].every(Number.isFinite) || x < 0 || y < 0 || x > sourceWidth || y > sourceHeight || u < 0 || v < 0 || u > targetWidth || v > targetHeight) throw Error('Each control must lie on the source photo and reference frame.');
    const row = [x / sourceWidth, y / sourceHeight, 1];
    for (let i = 0; i < 3; i++) { vx[i] += row[i] * u; vy[i] += row[i] * v; for (let j = 0; j < 3; j++) normal[i][j] += row[i] * row[j]; }
  }
  const a = solve(normal, vx), b = solve(normal, vy);
  const matrix: AffineRegistration['matrix'] = [a[0]/sourceWidth,b[0]/sourceWidth,a[1]/sourceHeight,b[1]/sourceHeight,a[2],b[2]];
  if (Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2]) < 1e-12) throw Error('These controls collapse the photo. Check the matched landmarks.');
  const errors = controls.map(({ source: [x,y], target: [u,v] }) => Math.hypot(matrix[0]*x+matrix[2]*y+matrix[4]-u,matrix[1]*x+matrix[3]*y+matrix[5]-v));
  return { matrix, rmsPixels: Math.sqrt(errors.reduce((sum, e) => sum + e*e, 0)/errors.length), maxErrorPixels: Math.max(...errors), controls: controls.map(c => ({ source: [...c.source], target: [...c.target] })) };
}
