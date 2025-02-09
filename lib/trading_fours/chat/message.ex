defmodule TradingFours.Chat.Message do
  use Ecto.Schema
  import Ecto.Changeset

  schema "messages" do
    field :midi_sequence, :map
    field :author, :string
    field :room_id, :string
    field :color, :string

    timestamps()
  end

  def changeset(message, attrs) do
    message
    |> cast(attrs, [:midi_sequence, :author, :room_id, :color])
    |> validate_required([:author, :room_id, :color])
    |> validate_midi_sequence()
  end

  defp validate_midi_sequence(changeset) do
    case get_field(changeset, :midi_sequence) do
      nil -> 
        changeset
      sequence when is_list(sequence) ->
        if Enum.all?(sequence, &valid_note?/1) do
          changeset
        else
          add_error(changeset, :midi_sequence, "must contain valid notes with time and duration")
        end
      _ ->
        add_error(changeset, :midi_sequence, "must be a list of notes")
    end
  end

  defp valid_note?(%{"note" => note, "time" => time, "duration" => duration}) 
    when (is_binary(note) or is_integer(note)) 
    and is_number(time) 
    and is_number(duration), do: true
  defp valid_note?(_), do: false
end
