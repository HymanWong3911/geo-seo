// zxcvbn 库无官方类型声明，这里手写一份最小可用版本。
declare module "zxcvbn" {
  export interface ZxcvbnResult {
    score: 0 | 1 | 2 | 3 | 4;
    guesses: number;
    guesses_log10: number;
    feedback: {
      warning?: string;
      suggestions: string[];
    };
    sequence: unknown[];
    calc_time: number;
  }

  export default function zxcvbn(password: string): ZxcvbnResult;
}
