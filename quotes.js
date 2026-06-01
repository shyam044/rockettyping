/**
 * quotes.js — Rocket Typing Quote Database
 *
 * Structure: each entry is { text: "...", author: "..." }
 * Categories (use QUOTES_DB.category to access individually,
 * or use QUOTES_ALL for the full flat pool):
 *   - inspiration   (40 quotes)
 *   - wisdom        (40 quotes)
 *   - science       (25 quotes)
 *   - literature    (30 quotes)
 *   - history       (25 quotes)
 *   - humor         (20 quotes)
 *   - short         (20 quotes, great for beginners)
 *
 * Total: 200 quotes
 *
 * To add more quotes, push objects into the relevant array.
 * To scale to 5,000–20,000 quotes, load additional JSON chunks
 * via fetch() and spread them into QUOTES_ALL before the first test.
 */

var QUOTES_DB = {

  inspiration: [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Our greatest glory is not in never falling, but in rising every time we fall.", author: "Confucius" },
    { text: "Believe you can and you are halfway there.", author: "Theodore Roosevelt" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "Do not watch the clock. Do what it does. Keep going.", author: "Sam Levenson" },
    { text: "You miss one hundred percent of the shots you do not take.", author: "Wayne Gretzky" },
    { text: "Whether you think you can or think you cannot, you are right.", author: "Henry Ford" },
    { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
    { text: "I have not failed. I have just found ten thousand ways that do not work.", author: "Thomas Edison" },
    { text: "A person who never made a mistake never tried anything new.", author: "Albert Einstein" },
    { text: "The best time to plant a tree was twenty years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "An unexamined life is not worth living.", author: "Socrates" },
    { text: "Spread love everywhere you go. Let no one ever come to you without leaving happier.", author: "Mother Teresa" },
    { text: "When you reach the end of your rope, tie a knot in it and hang on.", author: "Franklin D. Roosevelt" },
    { text: "Always remember that you are absolutely unique. Just like everyone else.", author: "Margaret Mead" },
    { text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", author: "Ralph Waldo Emerson" },
    { text: "You will face many defeats in life, but never let yourself be defeated.", author: "Maya Angelou" },
    { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
    { text: "In the end, it is not the years in your life that count. It is the life in your years.", author: "Abraham Lincoln" },
    { text: "Never let the fear of striking out keep you from playing the game.", author: "Babe Ruth" },
    { text: "Life is either a daring adventure or nothing at all.", author: "Helen Keller" },
    { text: "Many of life's failures are people who did not realize how close they were to success when they gave up.", author: "Thomas Edison" },
    { text: "You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose.", author: "Dr. Seuss" },
    { text: "If life were predictable it would cease to be life and be without flavor.", author: "Eleanor Roosevelt" },
    { text: "If you look at what you have in life, you will always have more.", author: "Oprah Winfrey" },
    { text: "If you set your goals ridiculously high and it is a failure, you will fail above everyone else's success.", author: "James Cameron" },
    { text: "Life is not measured by the number of breaths we take, but by the moments that take our breath away.", author: "Maya Angelou" },
    { text: "If you want to live a happy life, tie it to a goal, not to people or things.", author: "Albert Einstein" },
    { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
    { text: "It always seems impossible until it is done.", author: "Nelson Mandela" },
    { text: "Keep your face always toward the sunshine, and shadows will fall behind you.", author: "Walt Whitman" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Act as if what you do makes a difference. It does.", author: "William James" },
    { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
    { text: "Opportunities are usually disguised as hard work, so most people do not recognize them.", author: "Ann Landers" },
    { text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson" },
    { text: "Do not be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
    { text: "Dream big and dare to fail.", author: "Norman Vaughan" }
  ],

  wisdom: [
    { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
    { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
    { text: "Yesterday is history, tomorrow is a mystery, today is a gift of God, which is why we call it the present.", author: "Bill Keane" },
    { text: "Life is what happens when you are busy making other plans.", author: "John Lennon" },
    { text: "The purpose of our lives is to be happy.", author: "Dalai Lama" },
    { text: "Get busy living or get busy dying.", author: "Stephen King" },
    { text: "You only live once, but if you do it right, once is enough.", author: "Mae West" },
    { text: "Many people die at twenty-five and are not buried until seventy-five.", author: "Benjamin Franklin" },
    { text: "In three words I can sum up everything I have learned about life: it goes on.", author: "Robert Frost" },
    { text: "Love the life you live. Live the life you love.", author: "Bob Marley" },
    { text: "If you want to know what a man is really like, take notice of how he acts when he loses something.", author: "Nelson Mandela" },
    { text: "The mind is everything. What you think you become.", author: "Buddha" },
    { text: "Knowing others is wisdom; knowing yourself is enlightenment.", author: "Lao Tzu" },
    { text: "Do not pray for an easy life; pray for the strength to endure a difficult one.", author: "Bruce Lee" },
    { text: "The man who moves a mountain begins by carrying away small stones.", author: "Confucius" },
    { text: "Real knowledge is to know the extent of one's ignorance.", author: "Confucius" },
    { text: "He who learns but does not think is lost. He who thinks but does not learn is in great danger.", author: "Confucius" },
    { text: "Time you enjoy wasting is not wasted time.", author: "Marthe Troly-Curtin" },
    { text: "It is not the strongest of the species that survive, nor the most intelligent, but the one most responsive to change.", author: "Charles Darwin" },
    { text: "To handle yourself, use your head. To handle others, use your heart.", author: "Eleanor Roosevelt" },
    { text: "Too many of us are not living our dreams because we are living our fears.", author: "Les Brown" },
    { text: "The most common form of despair is not being who you are.", author: "Soren Kierkegaard" },
    { text: "I would rather die of passion than of boredom.", author: "Vincent van Gogh" },
    { text: "A wise man can learn more from a foolish question than a fool can learn from a wise answer.", author: "Bruce Lee" },
    { text: "Nothing in life is to be feared; it is only to be understood.", author: "Marie Curie" },
    { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
    { text: "Two things are infinite: the universe and human stupidity; and I am not sure about the universe.", author: "Albert Einstein" },
    { text: "A room without books is like a body without a soul.", author: "Marcus Tullius Cicero" },
    { text: "You only live once, but if you do it right, once is enough.", author: "Mae West" },
    { text: "To live is the rarest thing in the world. Most people exist, that is all.", author: "Oscar Wilde" },
    { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
    { text: "The unexamined life is not worth living.", author: "Socrates" },
    { text: "Happiness is not something ready-made. It comes from your own actions.", author: "Dalai Lama" },
    { text: "For every minute you are angry you lose sixty seconds of happiness.", author: "Ralph Waldo Emerson" },
    { text: "If you tell the truth, you do not have to remember anything.", author: "Mark Twain" },
    { text: "A friend is someone who knows all about you and still loves you.", author: "Elbert Hubbard" },
    { text: "Always forgive your enemies; nothing annoys them so much.", author: "Oscar Wilde" },
    { text: "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", author: "Ralph Waldo Emerson" },
    { text: "Without music, life would be a mistake.", author: "Friedrich Nietzsche" },
    { text: "We accept the love we think we deserve.", author: "Stephen Chbosky" }
  ],

  science: [
    { text: "Science is a way of thinking much more than it is a body of knowledge.", author: "Carl Sagan" },
    { text: "The good thing about science is that it is true whether or not you believe in it.", author: "Neil deGrasse Tyson" },
    { text: "Somewhere, something incredible is waiting to be known.", author: "Carl Sagan" },
    { text: "We are all made of star stuff.", author: "Carl Sagan" },
    { text: "The cosmos is within us. We are made of star stuff. We are a way for the universe to know itself.", author: "Carl Sagan" },
    { text: "Imagination is more important than knowledge. Knowledge is limited. Imagination encircles the world.", author: "Albert Einstein" },
    { text: "If I have seen further it is by standing on the shoulders of giants.", author: "Isaac Newton" },
    { text: "The universe is under no obligation to make sense to you.", author: "Neil deGrasse Tyson" },
    { text: "Not only is the universe stranger than we think, it is stranger than we can think.", author: "Werner Heisenberg" },
    { text: "The most beautiful thing we can experience is the mysterious. It is the source of all true art and science.", author: "Albert Einstein" },
    { text: "Science knows no country, because knowledge belongs to humanity, and is the torch which illuminates the world.", author: "Louis Pasteur" },
    { text: "An experiment is a question which science poses to nature, and a measurement is the recording of nature's answer.", author: "Max Planck" },
    { text: "The first gulp from the glass of natural sciences will turn you into an atheist, but at the bottom of the glass God is waiting for you.", author: "Werner Heisenberg" },
    { text: "Research is what I am doing when I do not know what I am doing.", author: "Wernher von Braun" },
    { text: "The important thing is not to stop questioning. Curiosity has its own reason for existing.", author: "Albert Einstein" },
    { text: "Physics is mathematical not because we know so much about the physical world, but because we know so little.", author: "Bertrand Russell" },
    { text: "In science one tries to tell people, in such a way as to be understood by everyone, something that no one ever knew before.", author: "Paul Dirac" },
    { text: "Science is the great antidote to the poison of enthusiasm and superstition.", author: "Adam Smith" },
    { text: "The art of discovery consists in seeing what everybody has seen and thinking what nobody has thought.", author: "Albert von Nagel" },
    { text: "When you have eliminated the impossible, whatever remains, however improbable, must be the truth.", author: "Arthur Conan Doyle" },
    { text: "There is no such thing as a failed experiment, only experiments with unexpected outcomes.", author: "Richard Buckminster Fuller" },
    { text: "Mathematics is the language in which God has written the universe.", author: "Galileo Galilei" },
    { text: "Nothing in life is to be feared, it is only to be understood. Now is the time to understand more, so that we may fear less.", author: "Marie Curie" },
    { text: "The day science begins to study non-physical phenomena, it will make more progress in one decade than in all the previous centuries.", author: "Nikola Tesla" },
    { text: "What we know is a drop, what we do not know is an ocean.", author: "Isaac Newton" }
  ],

  literature: [
    { text: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.", author: "Charles Dickens" },
    { text: "All that we see or seem is but a dream within a dream.", author: "Edgar Allan Poe" },
    { text: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.", author: "Dr. Seuss" },
    { text: "One must always be careful of books, and what is inside them, for words have the power to change us.", author: "Cassandra Clare" },
    { text: "There is no friend as loyal as a book.", author: "Ernest Hemingway" },
    { text: "If you only read the books that everyone else is reading, you can only think what everyone else is thinking.", author: "Haruki Murakami" },
    { text: "A reader lives a thousand lives before he dies. The man who never reads lives only one.", author: "George R.R. Martin" },
    { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
    { text: "It does not do to dwell on dreams and forget to live.", author: "J.K. Rowling" },
    { text: "We read to know we are not alone.", author: "C.S. Lewis" },
    { text: "The books that the world calls immoral are books that show the world its own shame.", author: "Oscar Wilde" },
    { text: "Words are, in my not-so-humble opinion, our most inexhaustible source of magic.", author: "J.K. Rowling" },
    { text: "I took a deep breath and listened to the old brag of my heart: I am, I am, I am.", author: "Sylvia Plath" },
    { text: "Until I feared I would lose it, I never loved to read. One does not love breathing.", author: "Harper Lee" },
    { text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.", author: "Jane Austen" },
    { text: "The world breaks everyone, and afterward, some are strong at the broken places.", author: "Ernest Hemingway" },
    { text: "You don't have to burn books to destroy a culture. Just get people to stop reading them.", author: "Ray Bradbury" },
    { text: "Outside of a dog, a book is man's best friend. Inside of a dog it's too dark to read.", author: "Groucho Marx" },
    { text: "A writer only begins a book. A reader finishes it.", author: "Samuel Johnson" },
    { text: "There is no greater agony than bearing an untold story inside you.", author: "Maya Angelou" },
    { text: "One day I will find the right words, and they will be simple.", author: "Jack Kerouac" },
    { text: "If there is a book that you want to read, but it has not been written yet, then you must write it.", author: "Toni Morrison" },
    { text: "The most wasted of all days is one without laughter.", author: "e e cummings" },
    { text: "Writing is the painting of the voice.", author: "Voltaire" },
    { text: "To write is to dare the soul.", author: "Terri Guillemets" },
    { text: "The first draft of anything is garbage.", author: "Ernest Hemingway" },
    { text: "You can make anything by writing.", author: "C.S. Lewis" },
    { text: "A good book is an event in my life.", author: "Stendhal" },
    { text: "Books are a uniquely portable magic.", author: "Stephen King" },
    { text: "Classic: a book which people praise and do not read.", author: "Mark Twain" }
  ],

  history: [
    { text: "Those who cannot remember the past are condemned to repeat it.", author: "George Santayana" },
    { text: "History is a set of lies agreed upon.", author: "Napoleon Bonaparte" },
    { text: "The most courageous act is still to think for yourself. Aloud.", author: "Coco Chanel" },
    { text: "I am the greatest. I said that even before I knew I was.", author: "Muhammad Ali" },
    { text: "Float like a butterfly, sting like a bee.", author: "Muhammad Ali" },
    { text: "Injustice anywhere is a threat to justice everywhere.", author: "Martin Luther King Jr." },
    { text: "The time is always right to do what is right.", author: "Martin Luther King Jr." },
    { text: "In the long run, we shape our lives, and we shape ourselves.", author: "Eleanor Roosevelt" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "It is not the man who has too little, but the man who craves more, that is poor.", author: "Seneca" },
    { text: "Every man dies. Not every man really lives.", author: "William Wallace" },
    { text: "Give me liberty, or give me death!", author: "Patrick Henry" },
    { text: "One small step for man, one giant leap for mankind.", author: "Neil Armstrong" },
    { text: "Ask not what your country can do for you; ask what you can do for your country.", author: "John F. Kennedy" },
    { text: "The ballot is stronger than the bullet.", author: "Abraham Lincoln" },
    { text: "No man is above the law and no man is below it; nor do we ask any man's permission when we ask him to obey it.", author: "Theodore Roosevelt" },
    { text: "We must learn to live together as brothers or perish together as fools.", author: "Martin Luther King Jr." },
    { text: "The only thing we have to fear is fear itself.", author: "Franklin D. Roosevelt" },
    { text: "Never, never, never give in.", author: "Winston Churchill" },
    { text: "Success is not the key to happiness. Happiness is the key to success.", author: "Albert Schweitzer" },
    { text: "I have a dream that my four little children will one day live in a nation where they will not be judged by the color of their skin but by the content of their character.", author: "Martin Luther King Jr." },
    { text: "History will be kind to me, for I intend to write it.", author: "Winston Churchill" },
    { text: "We shall defend our island, whatever the cost may be.", author: "Winston Churchill" },
    { text: "The arc of the moral universe is long, but it bends toward justice.", author: "Martin Luther King Jr." },
    { text: "In politics, stupidity is not a handicap.", author: "Napoleon Bonaparte" }
  ],

  humor: [
    { text: "Age is an issue of mind over matter. If you do not mind, it does not matter.", author: "Mark Twain" },
    { text: "I have never let my schooling interfere with my education.", author: "Mark Twain" },
    { text: "The secret of the universe is that you never find it out by looking.", author: "Karl Pilkington" },
    { text: "I am so clever that sometimes I do not understand a single word of what I am saying.", author: "Oscar Wilde" },
    { text: "The trouble with having an open mind is that people will insist on coming along and trying to put things in it.", author: "Terry Pratchett" },
    { text: "Do not take life too seriously. You will never get out of it alive.", author: "Elbert Hubbard" },
    { text: "By all means let's be open-minded, but not so open-minded that our brains drop out.", author: "Richard Dawkins" },
    { text: "I was born to make mistakes, not to fake perfection.", author: "Drake" },
    { text: "I could agree with you, but then we would both be wrong.", author: "Harvey Specter" },
    { text: "The best way to appreciate your job is to imagine yourself without one.", author: "Oscar Wilde" },
    { text: "Always borrow money from a pessimist. He will not expect it back.", author: "Oscar Wilde" },
    { text: "I have opinions of my own, strong opinions, but I do not always agree with them.", author: "George H.W. Bush" },
    { text: "Before you criticize someone, you should walk a mile in their shoes. That way, you are a mile away and you have their shoes.", author: "Jack Handey" },
    { text: "Light travels faster than sound. This is why some people appear bright until you hear them speak.", author: "Alan Dundes" },
    { text: "The elevator to success is out of order. You will have to use the stairs, one step at a time.", author: "Joe Girard" },
    { text: "People say nothing is impossible, but I do nothing every day.", author: "A.A. Milne" },
    { text: "I am not afraid of death; I just do not want to be there when it happens.", author: "Woody Allen" },
    { text: "If at first you do not succeed, then skydiving definitely is not for you.", author: "Steven Wright" },
    { text: "A bank is a place that will lend you money if you can prove that you do not need it.", author: "Bob Hope" },
    { text: "The difference between stupidity and genius is that genius has its limits.", author: "Albert Einstein" }
  ],

  short: [
    { text: "Less is more.", author: "Ludwig Mies van der Rohe" },
    { text: "No pain, no gain.", author: "Benjamin Franklin" },
    { text: "Just do it.", author: "Nike Slogan" },
    { text: "Be the change.", author: "Mahatma Gandhi" },
    { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
    { text: "Think different.", author: "Apple Inc." },
    { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
    { text: "Work hard, be kind.", author: "Conan O'Brien" },
    { text: "Make it work.", author: "Tim Gunn" },
    { text: "Carpe diem.", author: "Horace" },
    { text: "Live and let live.", author: "Scottish Proverb" },
    { text: "Hope for the best.", author: "English Proverb" },
    { text: "Love conquers all.", author: "Virgil" },
    { text: "Time heals all wounds.", author: "English Proverb" },
    { text: "Actions speak louder than words.", author: "Abraham Lincoln" },
    { text: "Practice makes perfect.", author: "English Proverb" },
    { text: "Fortune favors the bold.", author: "Virgil" },
    { text: "United we stand, divided we fall.", author: "Aesop" },
    { text: "To infinity and beyond.", author: "Buzz Lightyear" },
    { text: "Keep it simple.", author: "Kelly Johnson" }
  ]

};

/**
 * QUOTES_ALL — flat array of all quotes across every category.
 * This is the primary pool used by the typing engine.
 */
var QUOTES_ALL = (function() {
  var all = [];
  Object.keys(QUOTES_DB).forEach(function(cat) {
    QUOTES_DB[cat].forEach(function(q) { all.push(q); });
  });
  return all;
})();

/**
 * getRandomQuote([category])
 * Returns a random quote object { text, author }.
 * Pass a category string to restrict to that category.
 */
function getRandomQuote(category) {
  var pool = (category && QUOTES_DB[category]) ? QUOTES_DB[category] : QUOTES_ALL;
  return pool[Math.floor(Math.random() * pool.length)];
}
