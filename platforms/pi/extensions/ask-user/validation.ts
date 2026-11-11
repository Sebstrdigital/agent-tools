// Validate decision data, not permission to execute the proposed action.
export interface Question {
  question: string;
  options: string[];
  allowMultiple: boolean;
  allowFreeform: boolean;
}

function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid ask_user data: expected an object");
  }
  return value as Record<string, any>;
}

function flag(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error("Invalid ask_user boolean");
  return value;
}

function question(value: unknown): Question {
  const input = object(value);
  if (typeof input.question !== "string" || !input.question.trim()) {
    throw new Error("ask_user requires a non-empty, scoped question");
  }
  const raw = input.options ?? [];
  if (!Array.isArray(raw)) throw new Error("ask_user options must be an array");
  const options = raw.map((option: unknown) => {
    const title = object(option).title;
    if (typeof title !== "string" || !title.trim()) {
      throw new Error("Every ask_user option needs a non-empty title");
    }
    return title.trim();
  });
  if (new Set(options.map(title => title.toLowerCase())).size !== options.length) {
    throw new Error("ask_user option titles must be distinct");
  }
  const allowMultiple = flag(input.allowMultiple, false);
  const allowFreeform = flag(input.allowFreeform, true);
  if (!options.length && !allowFreeform) {
    throw new Error("ask_user needs offered options or an explicit freeform answer");
  }
  return { question: input.question.trim(), options, allowMultiple, allowFreeform };
}

export function validateRequest(value: unknown): Question[] {
  const input = object(value);
  if (input.questions == null) return [question(input)];
  if (input.question !== undefined || ["context", "options", "allowMultiple", "allowFreeform"].some(key => input[key] !== undefined)) {
    throw new Error("Use question or questions; batch-specific fields belong on each question");
  }
  if (!Array.isArray(input.questions) || input.questions.length < 2 || input.questions.length > 4) {
    throw new Error("ask_user batches require 2-4 independent questions");
  }
  const questions = input.questions.map(question);
  if (new Set(questions.map(q => q.question.toLowerCase())).size !== questions.length) {
    throw new Error("ask_user batch questions must be distinct");
  }
  return questions;
}

function response(value: unknown, prompt: Question): void {
  const answer = object(value);
  if (answer.kind === "selection") {
    const selections = answer.selections;
    if (!Array.isArray(selections) || !selections.length || (!prompt.allowMultiple && selections.length !== 1)) {
      throw new Error("Invalid ask_user selection count");
    }
    if (new Set(selections).size !== selections.length || selections.some(title => typeof title !== "string" || !prompt.options.includes(title))) {
      throw new Error("Invalid ask_user selection: an answer was not among the offered options");
    }
    if (answer.comment !== undefined && typeof answer.comment !== "string") {
      throw new Error("Invalid ask_user selection comment");
    }
  } else if (answer.kind === "freeform") {
    if (!prompt.allowFreeform || typeof answer.text !== "string" || !answer.text.trim()) {
      throw new Error("Invalid ask_user freeform answer; it is not an offered selection");
    }
  } else {
    throw new Error("Invalid ask_user response kind");
  }
}

export function validateResult(request: unknown, prompts: Question[], value: unknown): void {
  const input = object(request);
  const details = object(value);
  if (typeof details.cancelled !== "boolean") throw new Error("Invalid ask_user cancellation status");
  if (input.questions != null) {
    if (details.kind !== "batch" || !Array.isArray(details.answers)) throw new Error("Invalid ask_user batch result");
    if (details.cancelled) {
      if (details.answers.length) throw new Error("Cancelled ask_user batch must not contain answers");
      return;
    }
    if (!Array.isArray(details.questions) || details.questions.length !== prompts.length || details.answers.length !== prompts.length) {
      throw new Error("Invalid ask_user batch result length");
    }
    details.answers.forEach((value: unknown, index: number) => {
      if (details.questions[index]?.question?.trim() !== prompts[index].question) throw new Error("Mismatched ask_user question");
      const answer = object(value);
      if (answer.status === "answered") response(answer.response, prompts[index]);
      else if (answer.status !== "skipped" || answer.response !== undefined) throw new Error("Invalid ask_user skipped answer");
    });
  } else {
    if (details.kind === "batch") throw new Error("Invalid ask_user single-question result");
    if (details.cancelled) {
      if (details.response !== null) throw new Error("Cancelled ask_user question must not contain an answer");
      return;
    }
    if (details.question?.trim() !== prompts[0].question) throw new Error("Mismatched ask_user question");
    response(details.response, prompts[0]);
  }
}
