import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, Pencil } from "lucide-react";
import {
  getApiErrorMessage,
  getModels,
  updateAgent,
  type AgentProvider,
  type AgentResponse,
  type AgentUpdate,
} from "../helpers/helpers";
import { queryKeys } from "../lib/query-keys";
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

interface EditAgentModalProps {
  agent: AgentResponse;
}

const providers: AgentProvider[] = [
  "anthropic",
  "openai",
  "google",
  "deepseek",
];

function isAgentProvider(value: string): value is AgentProvider {
  return providers.some((provider) => provider === value);
}

function EditAgentModal({ agent }: EditAgentModalProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [provider, setProvider] = useState<AgentProvider>(agent.provider);
  const [model, setModel] = useState(agent.model);
  const [validationMessage, setValidationMessage] = useState("");
  const [updatedAgent, setUpdatedAgent] = useState<AgentResponse | null>(null);

  const modelsQuery = useQuery({
    queryKey: queryKeys.models,
    queryFn: getModels,
    enabled: open,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const updateMutation = useMutation({
    mutationFn: ({
      agentId,
      changes,
    }: {
      agentId: string;
      changes: AgentUpdate;
    }) => updateAgent(agentId, changes),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.agent(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents });
      setUpdatedAgent(updated);
    },
  });

  const availableModels =
    modelsQuery.data?.models.filter(
      (option) =>
        option.provider === provider && isAgentProvider(option.provider),
    ) ?? [];
  const providerOptions = providers.filter(
    (option) =>
      option === agent.provider ||
      modelsQuery.data?.models.some(
        (modelOption) => modelOption.provider === option,
      ),
  );
  const isPending = updateMutation.isPending;
  const errorMessage =
    validationMessage ||
    (updateMutation.isError
      ? getApiErrorMessage(
          updateMutation.error,
          "Could not update the agent. Please try again.",
        )
      : "");

  const resetForm = () => {
    setName(agent.name);
    setDescription(agent.description ?? "");
    setSystemPrompt(agent.system_prompt);
    setProvider(agent.provider);
    setModel(agent.model);
    setValidationMessage("");
    updateMutation.reset();
    setUpdatedAgent(null);
  };

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending && !nextOpen) {
      return;
    }
    if (!nextOpen) {
      setOpen(false);
      return;
    }
    handleOpen();
  };

  const clearError = () => {
    setValidationMessage("");
    if (updateMutation.isError) {
      updateMutation.reset();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const trimmedSystemPrompt = systemPrompt.trim();
    if (!trimmedName || !trimmedSystemPrompt || !model) {
      setValidationMessage("Complete all required fields and choose a model.");
      return;
    }

    const changes: AgentUpdate = {};
    if (trimmedName !== agent.name) {
      changes.name = trimmedName;
    }
    const nextDescription = trimmedDescription || null;
    if (nextDescription !== agent.description) {
      changes.description = nextDescription;
    }
    if (trimmedSystemPrompt !== agent.system_prompt) {
      changes.system_prompt = trimmedSystemPrompt;
    }
    if (provider !== agent.provider) {
      changes.provider = provider;
    }
    if (model !== agent.model) {
      changes.model = model;
    }

    if (Object.keys(changes).length === 0) {
      setValidationMessage("Make at least one change before saving.");
      return;
    }

    updateMutation.mutate({ agentId: agent.id, changes });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleOpen}
        className="h-9 gap-2 rounded-lg border-[#e3e9e3] bg-white px-3 text-xs text-[#526157] hover:bg-[#f5f7f4]"
      >
        <Pencil size={14} />
        Edit agent
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-xl border border-[#e5ebe4] bg-white p-6 shadow-xl">
          {updatedAgent ? (
            <div className="flex flex-col items-center py-7 text-center">
              <CheckCircle2 size={42} className="mb-4 text-[#79aa47]" />
              <DialogHeader className="items-center">
                <DialogTitle className="font-sans text-xl font-semibold text-[#25352a]">
                  Agent updated
                </DialogTitle>
                <DialogDescription className="mt-2">
                  Your changes to{" "}
                  <span className="font-medium text-[#526157]">
                    {updatedAgent.name}
                  </span>{" "}
                  have been saved.
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
                  Edit agent
                </DialogTitle>
                <DialogDescription>
                  Update this agent&apos;s name, instructions, or model.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-agent-name"
                    className="text-xs font-medium text-[#405046]"
                  >
                    Name <span className="text-[#8d4a3e]">*</span>
                  </label>
                  <Input
                    id="edit-agent-name"
                    name="name"
                    autoFocus
                    required
                    maxLength={100}
                    value={name}
                    onChange={(event) => {
                      setName(event.currentTarget.value);
                      clearError();
                    }}
                    className="h-10 rounded-lg border-[#e1e8e1] bg-[#fbfcfa] px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-agent-description"
                    className="text-xs font-medium text-[#405046]"
                  >
                    Description{" "}
                    <span className="text-[#91a096]">(optional)</span>
                  </label>
                  <Input
                    id="edit-agent-description"
                    name="description"
                    value={description}
                    onChange={(event) => {
                      setDescription(event.currentTarget.value);
                      clearError();
                    }}
                    placeholder="What this agent helps with"
                    className="h-10 rounded-lg border-[#e1e8e1] bg-[#fbfcfa] px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-agent-system-prompt"
                    className="text-xs font-medium text-[#405046]"
                  >
                    Instructions <span className="text-[#8d4a3e]">*</span>
                  </label>
                  <Textarea
                    id="edit-agent-system-prompt"
                    name="system_prompt"
                    required
                    rows={5}
                    value={systemPrompt}
                    onChange={(event) => {
                      setSystemPrompt(event.currentTarget.value);
                      clearError();
                    }}
                    className="min-h-28 resize-y rounded-lg border-[#e1e8e1] bg-[#fbfcfa] px-3"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="edit-agent-provider"
                      className="text-xs font-medium text-[#405046]"
                    >
                      Provider <span className="text-[#8d4a3e]">*</span>
                    </label>
                    <select
                      id="edit-agent-provider"
                      name="provider"
                      required
                      value={provider}
                      disabled={modelsQuery.isLoading || modelsQuery.isError}
                      onChange={(event) => {
                        const nextProvider = event.currentTarget.value;
                        if (!isAgentProvider(nextProvider)) {
                          return;
                        }
                        setProvider(nextProvider);
                        setModel(
                          nextProvider === agent.provider
                            ? agent.model
                            : (modelsQuery.data?.models.find(
                                (option) => option.provider === nextProvider,
                              )?.model_id ?? ""),
                        );
                        clearError();
                      }}
                      className="h-10 w-full rounded-lg border border-[#e1e8e1] bg-[#fbfcfa] px-3 text-xs text-[#344239] outline-none focus-visible:border-[#92b75f] focus-visible:ring-2 focus-visible:ring-[#92b75f]/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {providerOptions.map((option) => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="edit-agent-model"
                      className="text-xs font-medium text-[#405046]"
                    >
                      Model <span className="text-[#8d4a3e]">*</span>
                    </label>
                    <select
                      id="edit-agent-model"
                      name="model"
                      required
                      value={model}
                      disabled={modelsQuery.isLoading || modelsQuery.isError}
                      onChange={(event) => {
                        setModel(event.currentTarget.value);
                        clearError();
                      }}
                      className="h-10 w-full rounded-lg border border-[#e1e8e1] bg-[#fbfcfa] px-3 text-xs text-[#344239] outline-none focus-visible:border-[#92b75f] focus-visible:ring-2 focus-visible:ring-[#92b75f]/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {!availableModels.some(
                        (option) => option.model_id === agent.model,
                      ) &&
                        provider === agent.provider && (
                          <option value={agent.model}>
                            {agent.model} (currently configured)
                          </option>
                        )}
                      {availableModels.map((option) => (
                        <option key={option.model_id} value={option.model_id}>
                          {option.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {modelsQuery.isLoading && (
                  <p
                    className="flex items-center gap-2 text-[11px] text-[#829087]"
                    role="status"
                  >
                    <LoaderCircle size={14} className="animate-spin" />
                    Loading available models…
                  </p>
                )}
                {modelsQuery.isError && (
                  <p
                    className="rounded-lg bg-[#fbf2ef] px-3 py-2 text-xs text-[#944c3b]"
                    role="alert"
                  >
                    {getApiErrorMessage(
                      modelsQuery.error,
                      "Could not load available models. Provider and model changes are unavailable.",
                    )}
                  </p>
                )}
                {errorMessage && (
                  <p
                    className="rounded-lg bg-[#fbf2ef] px-3 py-2 text-xs text-[#944c3b]"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 border-t border-[#edf0ed] pt-4 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleOpenChange(false)}
                    className="h-10 rounded-lg px-4 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending || modelsQuery.isLoading}
                    className="h-10 gap-2 rounded-lg bg-[#172a21] px-4 text-xs text-white hover:bg-[#263d30]"
                  >
                    {isPending && (
                      <LoaderCircle size={14} className="animate-spin" />
                    )}
                    {isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default EditAgentModal;
