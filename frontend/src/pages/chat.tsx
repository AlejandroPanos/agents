import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bot,
  Check,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  createConversation,
  deleteConversation,
  getApiErrorMessage,
  getConversation,
  listAllAgents,
  listConversations,
  sendMessage,
  updateConversation,
  type ConversationResponse,
  type ConversationWithMessages,
  type MessageResponse,
} from "../helpers/helpers";
import { queryKeys } from "../lib/query-keys";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

function formatConversationLabel(conversation: ConversationResponse): string {
  if (conversation.title?.trim()) {
    return conversation.title;
  }
  return `Chat · ${new Date(conversation.created_at).toLocaleString()}`;
}

function ChatPage() {
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [draft, setDraft] = useState("");
  const [conversationToRename, setConversationToRename] = useState<ConversationResponse | null>(
    null,
  );
  const [conversationToDelete, setConversationToDelete] = useState<ConversationResponse | null>(
    null,
  );
  const [renameTitle, setRenameTitle] = useState("");
  const [renameError, setRenameError] = useState("");

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents,
    queryFn: listAllAgents,
  });
  const agents = agentsQuery.data ?? [];
  const activeAgentId = agents.some((agent) => agent.id === selectedAgentId)
    ? selectedAgentId
    : (agents[0]?.id ?? "");
  const activeAgent = agents.find((agent) => agent.id === activeAgentId);

  const conversationsQuery = useQuery({
    queryKey: queryKeys.conversations(activeAgentId),
    queryFn: () => listConversations(activeAgentId, { limit: 100 }),
    enabled: Boolean(activeAgentId),
  });
  const conversations = conversationsQuery.data ?? [];
  const activeConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) ??
    conversations[0] ??
    null;

  const conversationQuery = useQuery({
    queryKey: queryKeys.conversation(activeConversation?.id ?? ""),
    queryFn: () =>
      activeConversation
        ? getConversation(activeConversation.id)
        : Promise.reject(new Error("Conversation ID is required.")),
    enabled: Boolean(activeConversation?.id),
  });
  const messages = conversationQuery.data?.messages ?? [];

  const createConversationMutation = useMutation({
    mutationFn: (agentId: string) => createConversation(agentId),
    onSuccess: (conversation) => {
      setSelectedConversationId(conversation.id);
      queryClient.setQueryData<ConversationWithMessages>(queryKeys.conversation(conversation.id), {
        ...conversation,
        messages: [],
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations(conversation.agent_id),
      });
    },
  });
  const sendMessageMutation = useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      sendMessage(conversationId, { content }),
    onSuccess: ({ user_message, assistant_message }, variables) => {
      queryClient.setQueryData<ConversationWithMessages>(
        queryKeys.conversation(variables.conversationId),
        (current) =>
          current
            ? {
                ...current,
                updated_at: assistant_message.created_at,
                messages: [...current.messages, user_message, assistant_message],
              }
            : current,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations(activeAgentId),
      });
      setDraft("");
    },
  });
  const renameConversationMutation = useMutation({
    mutationFn: ({ conversationId, title }: { conversationId: string; title: string }) =>
      updateConversation(conversationId, { title }),
    onSuccess: (updatedConversation) => {
      queryClient.setQueryData<ConversationResponse[]>(
        queryKeys.conversations(updatedConversation.agent_id),
        (current) =>
          current?.map((conversation) =>
            conversation.id === updatedConversation.id ? updatedConversation : conversation,
          ),
      );
      queryClient.setQueryData<ConversationWithMessages>(
        queryKeys.conversation(updatedConversation.id),
        (current) => (current ? { ...current, ...updatedConversation } : current),
      );
      setConversationToRename(null);
    },
  });
  const deleteConversationMutation = useMutation({
    mutationFn: ({ conversationId }: { conversationId: string; agentId: string }) =>
      deleteConversation(conversationId),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData<ConversationResponse[]>(
        queryKeys.conversations(variables.agentId),
        (current) =>
          current?.filter((conversation) => conversation.id !== variables.conversationId),
      );
      queryClient.removeQueries({
        queryKey: queryKeys.conversation(variables.conversationId),
        exact: true,
      });
      if (selectedConversationId === variables.conversationId) {
        setSelectedConversationId("");
        setDraft("");
      }
      setConversationToDelete(null);
    },
  });

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    setSelectedConversationId("");
    setDraft("");
    createConversationMutation.reset();
    sendMessageMutation.reset();
  };

  const handleConversationChange = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setDraft("");
    sendMessageMutation.reset();
  };

  const handleCreateConversation = () => {
    if (!activeAgentId || createConversationMutation.isPending) {
      return;
    }
    sendMessageMutation.reset();
    createConversationMutation.mutate(activeAgentId);
  };

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !activeConversation || sendMessageMutation.isPending) {
      return;
    }
    sendMessageMutation.mutate({
      conversationId: activeConversation.id,
      content,
    });
  };

  const handleRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!conversationToRename) return;
    const title = renameTitle.trim();
    if (!title) {
      setRenameError("Enter a conversation name.");
      return;
    }
    setRenameError("");
    renameConversationMutation.mutate({
      conversationId: conversationToRename.id,
      title,
    });
  };

  const handleDelete = () => {
    if (!conversationToDelete) return;
    deleteConversationMutation.mutate({
      conversationId: conversationToDelete.id,
      agentId: conversationToDelete.agent_id,
    });
  };

  const mutationError = createConversationMutation.isError
    ? getApiErrorMessage(
        createConversationMutation.error,
        "Could not start a conversation. Please try again.",
      )
    : sendMessageMutation.isError
      ? getApiErrorMessage(
          sendMessageMutation.error,
          "Your message could not be sent. Please try again.",
        )
      : "";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-6xl flex-col">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-[#819087]">
            <MessageCircle size={15} />
            <span>Workspace</span>
            <span className="text-[#c2c9c4]">/</span>
            <span className="font-medium text-[#425148]">Chat</span>
          </div>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-[#18231e] sm:text-4xl">
            Chat<span className="text-[#88b94f]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[#758279]">Choose an agent and start a conversation.</p>
        </div>
      </header>

      <section className="flex min-h-120 flex-1 flex-col overflow-hidden rounded-xl border border-[#e5ebe5] bg-white shadow-[0_4px_18px_rgba(27,45,34,0.04)] md:flex-row">
        <aside className="flex max-h-60 w-full shrink-0 flex-col border-b border-[#edf0ed] bg-[#fcfdfb] md:max-h-none md:w-64 md:border-r md:border-b-0">
          <div className="flex items-center justify-between border-b border-[#edf0ed] px-4 py-4">
            <div>
              <h2 className="text-sm font-semibold text-[#344239]">Conversations</h2>
              <p className="mt-0.5 text-[10px] text-[#8b978e]">
                {activeAgent ? `With ${activeAgent.name}` : "Choose an agent"}
              </p>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Start a new conversation"
              title="New conversation"
              onClick={handleCreateConversation}
              disabled={!activeAgentId || createConversationMutation.isPending}
              className="rounded-lg border-[#e1e8e1] bg-white text-[#526157] hover:bg-[#f3f6f2]"
            >
              {createConversationMutation.isPending ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Plus size={15} />
              )}
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {conversationsQuery.isLoading && activeAgent && (
              <p className="flex items-center gap-2 px-3 py-4 text-xs text-[#89958d]">
                <LoaderCircle size={14} className="animate-spin" />
                Loading conversations…
              </p>
            )}
            {conversationsQuery.isError && (
              <p className="px-3 py-3 text-xs leading-5 text-[#944c3b]" role="alert">
                {getApiErrorMessage(conversationsQuery.error, "Could not load conversations.")}
              </p>
            )}
            {conversationsQuery.isSuccess && conversations.length === 0 && (
              <p className="px-3 py-4 text-xs leading-5 text-[#89958d]">
                No conversations yet. Start one with the plus button.
              </p>
            )}
            {conversations.map((conversation) => {
              const isSelected = activeConversation?.id === conversation.id;
              return (
                <div
                  key={conversation.id}
                  className={`group flex items-center gap-1 rounded-lg px-1 transition-colors ${
                    isSelected ? "bg-[#edf3e8]" : "hover:bg-[#f3f6f2]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleConversationChange(conversation.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`min-w-0 flex-1 truncate rounded-md px-2 py-2.5 text-left text-xs ${
                      isSelected ? "font-medium text-[#344b36]" : "text-[#647268]"
                    }`}
                  >
                    {formatConversationLabel(conversation)}
                  </button>
                  <div className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label={`Rename ${formatConversationLabel(conversation)}`}
                      title="Rename conversation"
                      onClick={() => {
                        setConversationToRename(conversation);
                        setRenameTitle(conversation.title ?? "");
                        setRenameError("");
                        renameConversationMutation.reset();
                      }}
                      className="flex size-7 items-center justify-center rounded-md text-[#89958d] hover:bg-white hover:text-[#344b36]"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${formatConversationLabel(conversation)}`}
                      title="Delete conversation"
                      onClick={() => {
                        setConversationToDelete(conversation);
                        deleteConversationMutation.reset();
                      }}
                      className="flex size-7 items-center justify-center rounded-md text-[#89958d] hover:bg-[#fbf2ef] hover:text-[#a14d3d]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-120 min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-end gap-3 border-b border-[#edf0ed] bg-[#fcfdfb] p-4 sm:p-5">
            <div className="min-w-52 flex-1 space-y-1.5">
              <label
                htmlFor="chat-agent"
                className="text-[10px] font-medium tracking-[0.12em] text-[#7b8a80] uppercase"
              >
                Agent
              </label>
              <Select
                value={activeAgentId || null}
                onValueChange={(value) => {
                  if (typeof value === "string") handleAgentChange(value);
                }}
                disabled={agentsQuery.isLoading || agents.length === 0}
              >
                <SelectTrigger
                  id="chat-agent"
                  className="h-10 w-full rounded-lg border-[#e1e8e1] bg-white pr-3 text-xs text-[#344239] focus-visible:border-[#92b75f] focus-visible:ring-[#92b75f]/20"
                >
                  <SelectValue
                    placeholder={agentsQuery.isLoading ? "Loading agents…" : "Select an agent"}
                  />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  className="rounded-lg border border-[#e1e8e1] bg-white"
                >
                  {agents.map((agent) => (
                    <SelectItem
                      key={agent.id}
                      value={agent.id}
                      className="py-2.5 text-xs text-[#344239] focus:bg-[#f1f5ee]"
                    >
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {agentsQuery.isError && (
            <p
              className="m-4 rounded-lg bg-[#fff8f6] px-3 py-2 text-xs text-[#944c3b]"
              role="alert"
            >
              {getApiErrorMessage(agentsQuery.error, "Could not load agents.")}
            </p>
          )}
          <div
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6"
            aria-live="polite"
            aria-label="Conversation messages"
          >
            {!activeAgent && agentsQuery.isSuccess && (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#eff4e9] text-[#688452]">
                  <Bot size={23} />
                </span>
                <h2 className="font-sans text-sm font-semibold text-[#405046]">
                  No agents to chat with
                </h2>
                <p className="mt-1 max-w-xs text-xs leading-5 text-[#839087]">
                  Create an agent first, then come back here to start a conversation.
                </p>
              </div>
            )}

            {agentsQuery.isLoading && (
              <div className="flex flex-1 items-center justify-center gap-2 py-12 text-xs text-[#839087]">
                <LoaderCircle size={16} className="animate-spin" />
                Loading agents…
              </div>
            )}

            {activeAgent && conversationsQuery.isLoading && (
              <div className="flex flex-1 items-center justify-center gap-2 py-12 text-xs text-[#839087]">
                <LoaderCircle size={16} className="animate-spin" />
                Loading conversations…
              </div>
            )}

            {activeAgent &&
              conversationsQuery.isSuccess &&
              conversations.length === 0 &&
              !activeConversation && (
                <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                  <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#eff4e9] text-[#688452]">
                    <MessageCircle size={22} />
                  </span>
                  <h2 className="font-sans text-sm font-semibold text-[#405046]">
                    Start chatting with {activeAgent.name}
                  </h2>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-[#839087]">
                    Create a conversation to send your first message.
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateConversation}
                    disabled={createConversationMutation.isPending}
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[#172a21] px-3 text-xs font-medium text-white transition-colors hover:bg-[#263d30] disabled:opacity-50"
                  >
                    <Plus size={14} />
                    New conversation
                  </button>
                </div>
              )}

            {activeConversation && conversationQuery.isLoading && (
              <div className="flex flex-1 items-center justify-center gap-2 py-12 text-xs text-[#839087]">
                <LoaderCircle size={16} className="animate-spin" />
                Loading messages…
              </div>
            )}

            {conversationQuery.isError && (
              <div className="flex flex-1 items-center justify-center">
                <p
                  className="rounded-lg bg-[#fff8f6] px-3 py-2 text-xs text-[#944c3b]"
                  role="alert"
                >
                  {getApiErrorMessage(conversationQuery.error, "Could not load this conversation.")}
                </p>
              </div>
            )}

            {activeConversation && conversationQuery.isSuccess && messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#eff4e9] text-[#688452]">
                  <Bot size={23} />
                </span>
                <h2 className="font-sans text-sm font-semibold text-[#405046]">
                  You&apos;re chatting with {activeAgent?.name}
                </h2>
                <p className="mt-1 text-xs text-[#839087]">Send a message to get started.</p>
              </div>
            )}

            {messages.map((message: MessageResponse) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eff4e9] text-[#688452]">
                    <Bot size={16} />
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${
                    message.role === "user"
                      ? "rounded-br-md bg-[#172a21] text-white"
                      : "rounded-bl-md border border-[#e8ede8] bg-[#fbfcfa] text-[#344239]"
                  }`}
                >
                  <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
                  <time
                    dateTime={message.created_at}
                    className={`mt-2 block text-[10px] ${
                      message.role === "user" ? "text-white/50" : "text-[#96a198]"
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                {message.role === "user" && (
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8eee7] text-[#68796c]">
                    <UserRound size={16} />
                  </span>
                )}
              </div>
            ))}

            {sendMessageMutation.isPending && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eff4e9] text-[#688452]">
                  <Bot size={16} />
                </span>
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#e8ede8] bg-[#fbfcfa] px-4 py-3 text-xs text-[#839087]">
                  <LoaderCircle size={14} className="animate-spin" />
                  {activeAgent?.name} is thinking…
                </div>
              </div>
            )}
          </div>

          {mutationError && (
            <p
              className="mx-4 mb-2 rounded-lg bg-[#fff8f6] px-3 py-2 text-xs text-[#944c3b]"
              role="alert"
            >
              {mutationError}
            </p>
          )}

          <form onSubmit={handleSend} className="border-t border-[#edf0ed] bg-[#fcfdfb] p-3 sm:p-4">
            <label htmlFor="chat-message" className="sr-only">
              Message
            </label>
            <div className="flex items-end gap-2 rounded-xl border border-[#e1e8e1] bg-white p-2 shadow-sm focus-within:border-[#92b75f] focus-within:ring-2 focus-within:ring-[#92b75f]/15">
              <textarea
                id="chat-message"
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
                placeholder={
                  activeConversation
                    ? `Message ${activeAgent?.name ?? "your agent"}…`
                    : "Start a new chat to send a message"
                }
                maxLength={32_000}
                rows={1}
                disabled={!activeConversation || sendMessageMutation.isPending}
                className="max-h-36 min-h-10 flex-1 resize-y border-0 bg-transparent px-2 py-2.5 text-sm text-[#344239] outline-none placeholder:text-[#a0aaa2] disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={
                  !activeConversation ||
                  !draft.trim() ||
                  sendMessageMutation.isPending ||
                  conversationQuery.isLoading
                }
                aria-label="Send message"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#172a21] text-white transition-colors hover:bg-[#263d30] disabled:cursor-not-allowed disabled:bg-[#d9e0d9] disabled:text-[#95a197]"
              >
                {sendMessageMutation.isPending ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-[#9aa49c]">
              <span>Responses are generated by your selected agent.</span>
              <span className="hidden sm:inline-flex sm:items-center sm:gap-1">
                Powered by your configured model
                <ArrowUpRight size={11} />
              </span>
            </div>
          </form>
        </div>
      </section>

      <Dialog
        open={Boolean(conversationToRename)}
        onOpenChange={(open) => {
          if (!open && !renameConversationMutation.isPending) {
            setConversationToRename(null);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-xl border border-[#e5ebe4] bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#25352a]">
              Rename conversation
            </DialogTitle>
            <DialogDescription>Choose a name that will help you find this chat.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <label htmlFor="conversation-title" className="sr-only">
              Conversation name
            </label>
            <Input
              id="conversation-title"
              autoFocus
              maxLength={200}
              value={renameTitle}
              onChange={(event) => {
                setRenameTitle(event.currentTarget.value);
                setRenameError("");
                renameConversationMutation.reset();
              }}
              placeholder="Conversation name"
              className="h-10 rounded-lg border-[#e1e8e1] bg-[#fbfcfa] px-3"
            />
            {(renameError || renameConversationMutation.isError) && (
              <p className="rounded-lg bg-[#fff8f6] px-3 py-2 text-xs text-[#944c3b]" role="alert">
                {renameError ||
                  getApiErrorMessage(
                    renameConversationMutation.error,
                    "Could not rename this conversation.",
                  )}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={renameConversationMutation.isPending}
                onClick={() => setConversationToRename(null)}
                className="h-10 rounded-lg px-4 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={renameConversationMutation.isPending}
                className="h-10 gap-2 rounded-lg bg-[#172a21] px-4 text-xs text-white hover:bg-[#263d30]"
              >
                {renameConversationMutation.isPending ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                {renameConversationMutation.isPending ? "Saving…" : "Save name"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(conversationToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteConversationMutation.isPending) {
            setConversationToDelete(null);
            deleteConversationMutation.reset();
          }
        }}
      >
        <DialogContent className="max-w-md rounded-xl border border-[#e5ebe4] bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#25352a]">
              Delete conversation?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-[#526157]">
                {conversationToDelete ? formatConversationLabel(conversationToDelete) : ""}
              </span>{" "}
              and its messages. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteConversationMutation.isError && (
            <p className="rounded-lg bg-[#fff8f6] px-3 py-2 text-xs text-[#944c3b]" role="alert">
              {getApiErrorMessage(
                deleteConversationMutation.error,
                "Could not delete this conversation. Please try again.",
              )}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteConversationMutation.isPending}
              onClick={() => {
                setConversationToDelete(null);
                deleteConversationMutation.reset();
              }}
              className="h-10 rounded-lg px-4 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteConversationMutation.isPending || !conversationToDelete}
              onClick={handleDelete}
              className="h-10 gap-2 rounded-lg px-4 text-xs"
            >
              {deleteConversationMutation.isPending && (
                <LoaderCircle size={14} className="animate-spin" />
              )}
              {deleteConversationMutation.isPending ? "Deleting…" : "Delete conversation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ChatPage;
