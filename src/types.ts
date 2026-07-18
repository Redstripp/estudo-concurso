export type Id = string;

export type ISODate = string;
export type ISODateTime = string;

export type JsonPrimitive = string | number | boolean | null;
export type Json = JsonPrimitive | Json[] | { [key: string]: Json };

export type Tema = 'claro' | 'escuro';
export type TipoQuestao = 'Errada' | 'Chutada';
export type StatusRevisao = 'pendente' | 'recuperada';
export type ResultadoRevisao = 'Acertou' | 'Errou';
export type AlternativasQuestao = Record<string, string> | string[];
export type ReviewSchedulerMode = 'legacy' | 'sm2_v1';
export type QuestaoReviewAlgorithm = 'sm2_v1';
export type QuestaoReviewOrigin = 'new' | 'migrated';
export type QuestaoReviewResult = 'correct' | 'incorrect';
export type StatusFilaSm2 = 'atrasada' | 'hoje' | 'proxima' | 'sem_agendamento';

export interface Usuario {
  id: Id;
  email?: string | null;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
  last_sign_in_at?: ISODateTime | null;
  user_metadata?: Record<string, Json>;
  app_metadata?: Record<string, Json>;
}

export interface Profile {
  id: Id;
  nome: string;
  tema?: Tema;
  criado_em?: ISODateTime;
  meta_diaria?: number | null;
  meta_minima?: number | null;
  meta_maxima?: number | null;
}

export interface Materia {
  id?: Id;
  user_id: Id;
  nome: string;
  criado_em?: ISODateTime;
}

export interface Questao {
  id?: Id;
  user_id: Id;
  sessao_id: Id;
  materia_id: Id;
  enunciado: string;
  alternativas: AlternativasQuestao;
  alternativa_correta: string;
  alternativa_marcada: string;
  comentario?: string | null;
  criado_em?: ISODateTime;
  motivo_erro?: string | null;
  nivel_confianca?: string | null;
  tipo_questao?: TipoQuestao;
  status_revisao?: StatusRevisao;
  revisar_novamente_em?: ISODate | null;
  revisao_ultima_data?: ISODate | null;
  revisao_ultima_resultado?: ResultadoRevisao | null;
  revisao_total_acertos?: number;
  revisao_total_erros?: number;
  ultima_confianca_revisao?: string | null;
  conceito_chave?: string | null;
  como_reconhecer?: string | null;
  acao_corretiva?: string | null;
  edital_topico_id?: Id | null;
  banca?: string | null;
  pegadinha_banca?: string | null;
  revisao_etapa?: number;
  materias?: {
    nome?: string | null;
  } | null;
  edital_topicos?: {
    titulo?: string | null;
    status?: string | null;
    peso?: number | null;
  } | null;
  tipoNormalizado?: TipoQuestao;
  review_state?: QuestaoReviewState | null;
  scheduler_mode?: ReviewSchedulerMode;
  status_fila_sm2?: StatusFilaSm2;
  dias_atraso_sm2?: number;
  prioridade_revisao?: number;
  motivos_prioridade_revisao?: string[];
}

export interface QuestaoCerta {
  id?: Id;
  user_id: Id;
  sessao_id: Id;
  materia_id: Id;
  quantidade: number;
  criado_em?: ISODateTime | null;
  materias?: {
    nome?: string | null;
  } | null;
}

export interface Revisao {
  id?: Id;
  user_id: Id;
  questao_id: Id;
  data_revisao?: ISODate;
  resultado: ResultadoRevisao;
  revisar_novamente_em?: ISODate | null;
  criado_em?: ISODateTime;
  resposta_marcada?: string | null;
  nivel_confianca?: string | null;
  motivo_erro?: string | null;
  conceito_chave?: string | null;
  como_reconhecer?: string | null;
  acao_corretiva?: string | null;
  scheduler_algorithm?: QuestaoReviewAlgorithm | null;
  review_grade?: number | null;
  source_attempt_id?: Id | null;
  response_time_ms?: number | null;
}

export interface QuestaoReviewState {
  id?: Id;
  user_id?: Id;
  questao_id: Id;
  algorithm_version?: QuestaoReviewAlgorithm;
  state_origin?: QuestaoReviewOrigin;
  easiness_factor?: number;
  repetition_count?: number;
  interval_days?: number;
  lapse_count?: number;
  correct_streak?: number;
  total_reviews?: number;
  last_grade?: number | null;
  last_result?: QuestaoReviewResult | null;
  last_reviewed_at?: ISODateTime | null;
  next_review_at?: ISODateTime | null;
  created_at?: ISODateTime | null;
  updated_at?: ISODateTime | null;
}

export interface QuestaoReviewEvent {
  id?: Id;
  user_id: Id;
  questao_id: Id;
  source_attempt_id?: Id | null;
  algorithm_version?: QuestaoReviewAlgorithm;
  event_origin?: QuestaoReviewOrigin;
  grade: number;
  was_correct: boolean;
  reviewed_at?: ISODateTime;
  previous_interval_days?: number;
  new_interval_days: number;
  previous_due_at?: ISODateTime | null;
  next_review_at: ISODateTime;
  response_time_ms?: number | null;
  created_at?: ISODateTime;
}

export interface Simulado {
  id?: Id;
  user_id: Id;
  data?: ISODate;
  nome: string;
  banca?: string | null;
  total_questoes: number;
  certas: number;
  erradas: number;
  tempo_minutos?: number | null;
  nota_percentual: number | string;
  comentario?: string | null;
  criado_em?: ISODateTime;
}

export interface ResultadoSimulado {
  id?: Id;
  simulado_id?: Id;
  questao_id?: Id;
  resultado: ResultadoRevisao;
  resposta_marcada?: string | null;
  nivel_confianca?: string | null;
  acertou?: boolean;
  revisar_novamente_em?: ISODate | null;
  revisao_etapa?: number;
  criado_em?: ISODateTime;
}

export interface EstatisticaMensal {
  id?: Id;
  user_id: Id;
  periodo_mes: ISODate;
  periodo_inicio: ISODate;
  periodo_fim: ISODate;
  total_questoes?: number;
  total_acertos?: number;
  total_erradas?: number;
  total_chutadas?: number;
  desempenho_por_materia?: Json[];
  motivos?: Record<string, Json>;
  confianca?: Record<string, Json>;
  criado_em?: ISODateTime;
  arquivado_em?: ISODateTime | null;
}

export interface SessaoEstudo {
  id?: Id;
  user_id: Id;
  data: ISODate;
  total_questoes?: number;
  criado_em?: ISODateTime;
}

export interface PlanoDiaMateria {
  id?: Id;
  user_id: Id;
  data: ISODate;
  materia_id: Id;
  meta_questoes?: number;
  criado_em?: ISODateTime;
  materias?: {
    nome?: string | null;
  } | null;
}

export interface ConfiguracaoRevisao {
  user_id: Id;
  dias_revisao?: number[];
  tempo_revisao_minutos?: number;
  ultima_revisao_geral?: ISODate | null;
  review_scheduler_mode?: ReviewSchedulerMode;
  review_timezone?: string;
  review_max_interval_days?: number;
  criado_em?: ISODateTime;
  atualizado_em?: ISODateTime;
}

export interface UsoIA {
  id?: Id;
  user_id: Id;
  data?: ISODate;
  total_analises?: number;
  criado_em?: ISODateTime;
  atualizado_em?: ISODateTime;
}
