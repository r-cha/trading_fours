defmodule TradingFoursWeb.ChatController do
  use TradingFoursWeb, :live_view
  @topic "chat"
  @colors ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", "#D4A5A5", "#9B59B6", "#3498DB", "#F1C40F", "#E74C3C"]

  def render(assigns) do
    ~H"""
    <div class="chat-container">
      <%= if @username do %>
        <header>
          <h1>Chat</h1>
          <p class="welcome">Welcome, <%= @username %>!</p>
        </header>

        <div class="messages-container">
          <%= for msg <- @messages do %>
            <div class="message">
              <strong style={"color: #{msg.color}"}><%= msg.author %>:</strong> <%= msg.content %>
            </div>
          <% end %>
        </div>

        <div class="input-container">
          <form phx-submit="send_message" id="chat-form" phx-hook="ChatForm">
            <input type="text" name="message" placeholder="Type a message..." id="chat-input">
            <button type="submit">Send</button>
          </form>
        </div>
      <% else %>
        <div class="login-container">
          <h1>Chat</h1>
          <form phx-submit="set_username">
            <input type="text" name="username" placeholder="Enter your name...">
            <button type="submit">Join Chat</button>
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
