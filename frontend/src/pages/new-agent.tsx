import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { createAgent, getModels, type AgentProvider, type AgentResponse } from "../helpers/helpers";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

interface NewAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const providers: AgentProvider[] = ["anthropic", "openai", "google", "deepseek"];

function isAgentProvider(value: string): value is AgentProvider {
  return providers.some((provider) => provider === value);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<{ detail?: unknown }>(error)) {
    return fallback;
  }

  const detail = error.response?.data?.detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail.flatMap((issue) =>
      typeof issue === "object" && issue !== null && "msg" in issue && typeof issue.msg === "string"
        ? [issue.msg]
        : [],
    );
    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  return error.response ? fallback : "Could not connect to the backend. Please try again.";
}

function NewAgentModal({ open, onOpenChange }: NewAgentModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [provider, setProvider] = useState<AgentProvider | "">("");
  const [model, setModel] = useState("");
  const [validationError, setValidationError] = useState("");
  const [createdAgent, setCreatedAgent] = useState<AgentResponse | null>(null);

  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: getModels,
    enabled: open,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const createAgentMutation = useMutation({
    mutationFn: createAgent,
    onSuccess: setCreatedAgent,
  });

  const models =
    modelsQuery.data?.models.filter((option) => isAgentProvider(option.provider)) ?? [];
  const availableProviders = providers.filter((option) =>
    models.some((modelOption) => modelOption.provider === option),
  );
  const selectedProvider =
    provider && availableProviders.includes(provider) ? provider : (availableProviders[0] ?? "");
  const availableModels = models.filter((option) => option.provider === selectedProvider);
  const selectedModel = availableModels.some((option) => option.model_id === model)
    ? model
    : (availableModels[0]?.model_id ?? "");
  const isLoadingModels = modelsQuery.isLoading;
  const modelError = modelsQuery.isError
    ? getErrorMessage(modelsQuery.error, "Could not load available models.")
    : modelsQuery.isSuccess && models.length === 0
      ? "No compatible models are available. Configure an enabled model first."
      : "";
  const submitError =
    validationError ||
    (createAgentMutation.isError
      ? getErrorMessage(createAgentMutation.error, "Could not create the agent. Please try again.")
      : "");
  const isSubmitting = createAgentMutation.isPending;

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting && !nextOpen) {
      return;
    }
    if (!nextOpen) {
      setName("");
      setDescription("");
      setSystemPrompt("");
      setProvider("");
      setModel("");
      setValidationError("");
      createAgentMutation.reset();
      setCreatedAgent(null);
    }
    onOpenChange(nextOpen);
  };

  const clearSubmitError = () => {
    setValidationError("");
    if (createAgentMutation.isError) {
      createAgentMutation.reset();
    }
  };

  const handleProviderChange = (nextProvider: string) => {
    if (!isAgentProvider(nextProvider)) {
      return;
    }

    setProvider(nextProvider);
    setModel("");
    clearSubmitError();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError("");

    const trimmedName = name.trim();
    const trimmedSystemPrompt = systemPrompt.trim();
    if (!trimmedName || !trimmedSystemPrompt || !selectedProvider || !selectedModel) {
      setValidationError("Complete all required fields and choose an available model.");
      return;
    }

    createAgentMutation.mutate({
      name: trimmedName,
      description: description.trim() || null,
      system_prompt: trimmedSystemPrompt,
      provider: selectedProvider,
      model: selectedModel,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-xl border border-[#e5ebe4] bg-white p-6 shadow-xl">
        {createdAgent ? (
          <div className="flex flex-col items-center py-7 text-center">
            <CheckCircle2 size={42} className="mb-4 text-[#79aa47]" />
            <DialogHeader className="items-center">
              <DialogTitle className="font-sans text-xl font-semibold text-[#25352a]">
                Agent created
              </DialogTitle>
              <DialogDescription className="mt-2">
                <span className="font-medium text-[#526157]">{createdAgent.name}</span> is ready in
                your workspace.
              </DialogDescription>
            </DialogHeader>
            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="mt-6 h-10 rounded-lg bg-[#172a21] px-5 text-xs text-white hover:bg-[#263d30]"
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="mb-2 pr-8">
              <DialogTitle className="font-sans text-xl font-semibold text-[#25352a]">
                Create a new agent
              </DialogTitle>
              <DialogDescription>
                Give your agent a name, instructions, and an available model.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="agent-name" className="text-xs font-medium text-[#405046]">
                  Name <span className="text-[#8d4a3e]">*</span>
                </label>
                <Input
                  id="agent-name"
                  name="name"
                  autoFocus
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => {
                    setName(event.currentTarget.value);
                    clearSubmitError();
                  }}
                  placeholder="e.g. Research assistant"
                  className="h-10 rounded-lg border-[#e1e8e1] bg-[#fbfcfa] px-3"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="agent-description" className="text-xs font-medium text-[#405046]">
                  Description <span className="text-[#91a096]">(optional)</span>
                </label>
                <Input
                  id="agent-description"
                  name="description"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.currentTarget.value);
                    clearSubmitError();
                  }}
                  placeholder="What this agent helps with"
                  className="h-10 rounded-lg border-[#e1e8e1] bg-[#fbfcfa] px-3"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="agent-system-prompt" className="text-xs font-medium text-[#405046]">
                  Instructions <span className="text-[#8d4a3e]">*</span>
                </label>
                <Textarea
                  id="agent-system-prompt"
                  name="system_prompt"
                  required
                  value={systemPrompt}
                  onChange={(event) => {
                    setSystemPrompt(event.currentTarget.value);
                    clearSubmitError();
                  }}
                  placeholder="Describe the agent's role, goals, and how it should respond."
                  rows={5}
                  className="min-h-28 resize-y rounded-lg border-[#e1e8e1] bg-[#fbfcfa] px-3"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="agent-provider" className="text-xs font-medium text-[#405046]">
                    Provider <span className="text-[#8d4a3e]">*</span>
                  </label>
                  <select
                    id="agent-provider"
                    name="provider"
                    required
                    value={selectedProvider}
                    disabled={isLoadingModels || availableProviders.length === 0}
                    onChange={(event) => handleProviderChange(event.currentTarget.value)}
                    className="h-10 w-full rounded-lg border border-[#e1e8e1] bg-[#fbfcfa] px-3 text-xs text-[#344239] outline-none focus-visible:border-[#92b75f] focus-visible:ring-2 focus-visible:ring-[#92b75f]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {availableProviders.length === 0 && (
                      <option value="">No providers available</option>
                    )}
                    {availableProviders.map((option) => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="agent-model" className="text-xs font-medium text-[#405046]">
                    Model <span className="text-[#8d4a3e]">*</span>
                  </label>
                  <select
                    id="agent-model"
                    name="model"
                    required
                    value={selectedModel}
                    disabled={isLoadingModels || availableModels.length === 0}
                    onChange={(event) => {
                      setModel(event.currentTarget.value);
                      clearSubmitError();
                    }}
                    className="h-10 w-full rounded-lg border border-[#e1e8e1] bg-[#fbfcfa] px-3 text-xs text-[#344239] outline-none focus-visible:border-[#92b75f] focus-visible:ring-2 focus-visible:ring-[#92b75f]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoadingModels && <option value="">Loading models…</option>}
                    {!isLoadingModels && availableModels.length === 0 && (
                      <option value="">No models available</option>
                    )}
                    {availableModels.map((option) => (
                      <option key={option.model_id} value={option.model_id}>
                        {option.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isLoadingModels && (
                <p className="flex items-center gap-2 text-[11px] text-[#829087]" role="status">
                  <LoaderCircle size={14} className="animate-spin" />
                  Loading available models…
                </p>
              )}
              {modelError && (
                <p
                  className="rounded-lg bg-[#fbf2ef] px-3 py-2 text-xs text-[#944c3b]"
                  role="alert"
                >
                  {modelError}
                </p>
              )}
              {submitError && (
                <p
                  className="rounded-lg bg-[#fbf2ef] px-3 py-2 text-xs text-[#944c3b]"
                  role="alert"
                >
                  {submitError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-[#edf0ed] pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => handleOpenChange(false)}
                  className="h-10 rounded-lg px-4 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isLoadingModels || !selectedProvider || !selectedModel}
                  className="h-10 gap-2 rounded-lg bg-[#172a21] px-4 text-xs text-white hover:bg-[#263d30]"
                >
                  {isSubmitting && <LoaderCircle size={14} className="animate-spin" />}
                  {isSubmitting ? "Creating…" : "Create agent"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default NewAgentModal;
