import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bot,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  UserRound,
} from "lucide-react";
import {
  createConversation,
  getApiErrorMessage,
  getConversation,
  listAllAgents,
  listConversations,
  sendMessage,
  type ConversationResponse,
  type ConversationWithMessages,
  type MessageResponse,
} from "../helpers/helpers";
import { queryKeys } from "../lib/query-keys";

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
    conversations.find(
      (conversation) => conversation.id === selectedConversationId,
    ) ??
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
      queryClient.setQueryData<ConversationWithMessages>(
        queryKeys.conversation(conversation.id),
        {
          ...conversation,
          messages: [],
        },
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations(conversation.agent_id),
      });
    },
  });
  const sendMessageMutation = useMutation({
    mutationFn: ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => sendMessage(conversationId, { content }),
    onSuccess: ({ user_message, assistant_message }, variables) => {
      queryClient.setQueryData<ConversationWithMessages>(
        queryKeys.conversation(variables.conversationId),
        (current) =>
          current
            ? {
                ...current,
                updated_at: assistant_message.created_at,
                messages: [
                  ...current.messages,
                  user_message,
                  assistant_message,
                ],
              }
            : current,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations(activeAgentId),
      });
      setDraft("");
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
          <p className="mt-2 text-sm text-[#758279]">
            Choose an agent and start a conversation.
          </p>
        </div>
      </header>

      <section className="flex min-h-[30rem] flex-1 flex-col overflow-hidden rounded-xl border border-[#e5ebe5] bg-white shadow-[0_4px_18px_rgba(27,45,34,0.04)]">
        <div className="flex flex-wrap items-end gap-3 border-b border-[#edf0ed] bg-[#fcfdfb] p-4 sm:p-5">
          <div className="min-w-52 flex-1 space-y-1.5">
            <label
              htmlFor="chat-agent"
              className="text-[10px] font-medium tracking-[0.12em] text-[#7b8a80] uppercase"
            >
              Agent
            </label>
            <select
              id="chat-agent"
              value={activeAgentId}
              onChange={(event) => handleAgentChange(event.currentTarget.value)}
              disabled={agentsQuery.isLoading || agents.length === 0}
              className="h-10 w-full rounded-lg border border-[#e1e8e1] bg-white px-3 text-xs text-[#344239] outline-none focus-visible:border-[#92b75f] focus-visible:ring-2 focus-visible:ring-[#92b75f]/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {agentsQuery.isLoading && (
                <option value="">Loading agents…</option>
              )}
              {!agentsQuery.isLoading && agents.length === 0 && (
                <option value="">No agents available</option>
              )}
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-52 flex-[1.4] space-y-1.5">
            <label
              htmlFor="chat-conversation"
              className="text-[10px] font-medium tracking-[0.12em] text-[#7b8a80] uppercase"
            >
              Conversation
            </label>
            <select
              id="chat-conversation"
              value={activeConversation?.id ?? ""}
              onChange={(event) =>
                handleConversationChange(event.currentTarget.value)
              }
              disabled={
                !activeAgentId ||
                conversationsQuery.isLoading ||
                conversations.length === 0
              }
              className="h-10 w-full rounded-lg border border-[#e1e8e1] bg-white px-3 text-xs text-[#344239] outline-none focus-visible:border-[#92b75f] focus-visible:ring-2 focus-visible:ring-[#92b75f]/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {conversationsQuery.isLoading && (
                <option value="">Loading conversations…</option>
              )}
              {!conversationsQuery.isLoading && conversations.length === 0 && (
                <option value="">Start a new conversation</option>
              )}
              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {formatConversationLabel(conversation)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleCreateConversation}
            disabled={!activeAgentId || createConversationMutation.isPending}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#dfe7df] bg-white px-3 text-xs font-medium text-[#46564b] transition-colors hover:bg-[#f4f7f2] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createConversationMutation.isPending ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Plus size={15} />
            )}
            New chat
          </button>
        </div>

        {agentsQuery.isError && (
          <p
            className="m-4 rounded-lg bg-[#fff8f6] px-3 py-2 text-xs text-[#944c3b]"
            role="alert"
          >
            {getApiErrorMessage(agentsQuery.error, "Could not load agents.")}
          </p>
        )}
        {conversationsQuery.isError && (
          <p
            className="m-4 rounded-lg bg-[#fff8f6] px-3 py-2 text-xs text-[#944c3b]"
            role="alert"
          >
            {getApiErrorMessage(
              conversationsQuery.error,
              "Could not load conversations.",
            )}
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
                Create an agent first, then come back here to start a
                conversation.
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
                {getApiErrorMessage(
                  conversationQuery.error,
                  "Could not load this conversation.",
                )}
              </p>
            </div>
          )}

          {activeConversation &&
            conversationQuery.isSuccess &&
            messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#eff4e9] text-[#688452]">
                  <Bot size={23} />
                </span>
                <h2 className="font-sans text-sm font-semibold text-[#405046]">
                  You&apos;re chatting with {activeAgent?.name}
                </h2>
                <p className="mt-1 text-xs text-[#839087]">
                  Send a message to get started.
                </p>
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
                <p className="whitespace-pre-wrap wrap-break-word">
                  {message.content}
                </p>
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

        <form
          onSubmit={handleSend}
          className="border-t border-[#edf0ed] bg-[#fcfdfb] p-3 sm:p-4"
        >
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
      </section>
    </div>
  );
}

export default ChatPage;
