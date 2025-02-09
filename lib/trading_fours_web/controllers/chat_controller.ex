defmodule TradingFoursWeb.ChatController do
  use TradingFoursWeb, :live_view
  @topic "chat"

  def render(assigns) do
    ~H"""
    <h1>Chat</h1>
    <%= if @username do %>
      <form phx-submit="send_message">
        <input type="text" name="message" placeholder="Type a message...">
        <button type="submit">Send</button>
      </form>
      <%= for msg <- @messages do %>
        <div class="message">
          <strong><%= msg.author %>:</strong> <%= msg.content %>
        </div>
      <% end %>
    <% else %>
      <form phx-submit="set_username">
        <input type="text" name="username" placeholder="Enter your name...">
        <button type="submit">Join Chat</button>
      </form>
    <% end %>
    """
  end

  def mount(_params, _session, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(TradingFours.PubSub, @topic)
    end
    
    {:ok, assign(socket, messages: [], username: nil)}
  end

  def handle_event("set_username", %{"username" => username}, socket) do
    {:noreply, assign(socket, username: username)}
  end

  def handle_event("send_message", %{"message" => message}, socket) do
    message_item = %{author: socket.assigns.username, content: message}
    Phoenix.PubSub.broadcast(TradingFours.PubSub, @topic, {:new_message, message_item})
    new_messages = [message_item | socket.assigns.messages]
    {:noreply, assign(socket, messages: new_messages)}
  end

  def handle_info({:new_message, message_item}, socket) do
    new_messages = [message_item | socket.assigns.messages]
    {:noreply, assign(socket, messages: new_messages)}
  end
end
