defmodule TradingFoursWeb.ChatController do
  use TradingFoursWeb, :live_view
  @topic "chat"
  @colors ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", "#D4A5A5", "#9B59B6", "#3498DB", "#F1C40F", "#E74C3C"]

  def render(assigns) do
    ~H"""
    <div class="h-screen flex flex-col">
      <%= if @username do %>
        <header class="bg-white border-b border-gray-200 p-4">
          <h1 class="text-2xl font-bold">Chat</h1>
          <p class="text-gray-600">Welcome, <%= @username %>!</p>
        </header>

        <div class="flex-1 overflow-y-auto flex flex-col-reverse p-4 space-y-reverse space-y-2">
          <%= for msg <- @messages do %>
            <div class="message py-1">
              <strong style={"color: #{msg.color}"}><%= msg.author %>:</strong> <%= msg.content %>
            </div>
          <% end %>
        </div>

        <div class="border-t border-gray-200 p-4 bg-white">
          <form phx-submit="send_message" id="chat-form" phx-hook="ChatForm" class="flex gap-2">
            <input type="text" name="message" placeholder="Type a message..." id="chat-input"
                   class="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:border-blue-500">
            <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">Send</button>
          </form>
        </div>
      <% else %>
        <div class="h-screen flex flex-col items-center justify-center p-4 space-y-4">
          <h1 class="text-2xl font-bold">Chat</h1>
          <form phx-submit="set_username" class="flex gap-2">
            <input type="text" name="username" placeholder="Enter your name..." 
                   class="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:border-blue-500">
            <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">Join Chat</button>
          </form>
        </div>
      <% end %>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(TradingFours.PubSub, @topic)
    end
    
    {:ok, assign(socket, messages: [], username: nil, user_color: nil)}
  end

  def handle_event("set_username", %{"username" => username}, socket) do
    color = Enum.random(@colors)
    {:noreply, assign(socket, username: username, user_color: color)}
  end

  def handle_event("send_message", %{"message" => message}, socket) do
    message_item = %{author: socket.assigns.username, content: message, color: socket.assigns.user_color}
    Phoenix.PubSub.broadcast(TradingFours.PubSub, @topic, {:new_message, message_item})
    {:noreply, socket}
  end

  def handle_info({:new_message, message_item}, socket) do
    new_messages = [message_item | socket.assigns.messages]
    {:noreply, assign(socket, messages: new_messages)}
  end
end
