defmodule TradingFoursWeb.ChatController do
  use TradingFoursWeb, :live_view
  import Ecto.Query
  alias TradingFoursWeb.Presence
  alias TradingFours.Chat.Message
  alias TradingFours.Repo
  def topic(room_id), do: "chat:#{room_id}"
  def presence_topic(room_id), do: "chat:#{room_id}:presence"
  @colors ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", "#D4A5A5", "#9B59B6", "#3498DB", "#F1C40F", "#E74C3C"]

  def render(assigns) do
    ~H"""
    <div class="h-[calc(100vh-64px)] flex flex-col">
      <%= if @username do %>
        <div class="flex-none">
          <div class="flex">
            <div class="flex-1">
              <header class="bg-white border-b border-gray-200 p-4">
                <h1 class="text-2xl font-bold">Chat</h1>
                <p class="text-gray-600">Welcome, <%= @username %>!</p>
              </header>
            </div>
            <div class="w-64 bg-gray-50 border-l border-gray-200 p-4">
              <h2 class="text-lg font-semibold mb-2">Online Users</h2>
              <%= for {username, user_data} <- @online_users do %>
                <div class="flex items-center space-x-2 mb-1">
                  <div class="w-2 h-2 rounded-full bg-green-400"></div>
                  <span style={"color: #{user_data.color}"}><%= username %></span>
                </div>
              <% end %>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto mb-4">
          <div class="flex flex-col p-4 space-y-4">
            <%= for msg <- @messages do %>
              <div class="message flex justify-start">
                <div class="bg-gray-100 px-4 py-3 rounded-lg w-full">
                  <div class="flex items-center justify-between mb-2">
                    <div class="text-sm font-medium" style={"color: #{msg.color}"}><%= msg.author %></div>
                  </div>
                  <div class="midi-sequence-player" 
                       id={"midi-sequence-#{msg.id}"} 
                       phx-hook="MidiPlayer">
                    <div class="flex flex-col gap-2">
                      <div class="mini-piano-roll border border-gray-200 rounded">
                        <canvas id={"piano-roll-#{msg.id}"} 
                                class="w-full h-24"
                                data-sequence={Jason.encode!(msg.midi_sequence)}></canvas>
                      </div>
                      <button class="bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600 transition text-sm">
                        Play Sequence
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            <% end %>
          </div>
        </div>

        <div class="piano-container flex-none" id="piano-container-main" phx-hook="Piano">
            <div class="flex justify-center gap-2 mb-2">
              <button id="playButton" class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition">Play</button>
              <button id="clearButton" class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition">Clear</button>
            </div>
            <canvas id="pianoRoll" class="piano-roll"></canvas>
            <canvas id="pianoKeys" class="piano-keys"></canvas>
        </div>
        <div class="flex-none border-t border-gray-200 p-4 bg-white">
          <button phx-click="send_midi" class="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
            Send Piano Sequence
          </button>
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

  def mount(%{"room_id" => room_id}, _session, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(TradingFours.PubSub, topic(room_id))
      Phoenix.PubSub.subscribe(TradingFours.PubSub, presence_topic(room_id))
    end
    
    messages = Repo.all(
      from m in Message,
      where: m.room_id == ^room_id,
      order_by: [asc: m.inserted_at],
      limit: 100
    )
    
    {:ok, assign(socket, 
      room_id: room_id,
      messages: messages, 
      username: nil, 
      user_color: nil, 
      online_users: %{}
    )}
  end

  def handle_event("set_username", %{"username" => username}, socket) do
    color = Enum.random(@colors)
    
    {:ok, _} = Presence.track(
      self(),
      presence_topic(socket.assigns.room_id),
      username,
      %{
        color: color,
        online_at: inspect(System.system_time(:second))
      }
    )
    
    {:noreply, assign(socket, username: username, user_color: color)}
  end

  def handle_event("send_midi", _params, socket) do
    # Push an event to the Piano hook to request the current sequence
    {:noreply, push_event(socket, "request_midi_sequence", %{})}
  end

  def handle_event("midi_sequence_ready", %{"sequence" => midi_sequence}, socket) do
    IO.inspect(midi_sequence, label: "Received MIDI Sequence")
    if is_nil(midi_sequence) || is_valid_midi_sequence?(midi_sequence) do
      IO.inspect(processed_sequence, label: "Processed MIDI Sequence")
      processed_sequence = if is_list(midi_sequence) do
        Enum.map(midi_sequence, fn note ->
          %{
            "note" => note["note"],
            "time" => note["time"],
            "duration" => note["duration"]
          }
        end)
      end

      message_params = %{
        midi_sequence: processed_sequence || midi_sequence,
        author: socket.assigns.username,
        room_id: socket.assigns.room_id,
        color: socket.assigns.user_color
      }

      case create_message(message_params) do
        {:ok, message} ->
          message_item = %{
            id: message.id,
            author: message.author,
            midi_sequence: message.midi_sequence,
            color: message.color,
            inserted_at: message.inserted_at
          }
          
          # Broadcast to all users in the room
          Phoenix.PubSub.broadcast(
            TradingFours.PubSub, 
            topic(socket.assigns.room_id), 
            {:new_message, message_item}
          )
          
          {:noreply, 
            socket 
            |> assign(:messages, socket.assigns.messages ++ [message_item])
            |> put_flash(:info, "MIDI sequence sent successfully")}
        
        {:error, changeset} ->
          {:noreply, 
            socket
            |> put_flash(:error, "Failed to send MIDI sequence: #{error_messages(changeset)}")}
      end
    else
      {:noreply, 
        socket
        |> put_flash(:error, "Invalid MIDI sequence format")}
    end
  end

  # Validate MIDI sequence format
  defp is_valid_midi_sequence?(nil), do: true
  defp is_valid_midi_sequence?(sequence) when is_list(sequence) do
    Enum.all?(sequence, fn note ->
      is_map(note) and
      (is_integer(note["note"]) or is_binary(note["note"])) and
      is_number(note["time"]) and
      is_number(note["duration"])
    end)
  end
  defp is_valid_midi_sequence?(_), do: false

  # Create a new message with error handling
  defp create_message(params) do
    %Message{}
    |> Message.changeset(params)
    |> Repo.insert()
  end

  # Format error messages
  defp error_messages(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)
    |> Enum.map(fn {k, v} -> "#{k} #{v}" end)
    |> Enum.join(", ")
  end

  # Ensure the sequence is properly formatted for storage
  defp process_midi_sequence(sequence) when is_list(sequence) do
    Enum.map(sequence, fn note ->
      %{
        "note" => note["note"],
        "time" => note["time"],
        "duration" => note["duration"]
      }
    end)
  end
  defp process_midi_sequence(sequence), do: sequence

  def handle_info({:new_message, message_item}, socket) do
    {:noreply, assign(socket, :messages, socket.assigns.messages ++ [message_item])}
  end


  def handle_info(%{event: "presence_diff", payload: _diff}, socket) do
    online_users = Presence.list(presence_topic(socket.assigns.room_id))
    |> Enum.map(fn {username, %{metas: [meta | _]}} -> 
      {username, meta}
    end)
    |> Enum.into(%{})
    
    {:noreply, assign(socket, :online_users, online_users)}
  end
end
