(function () {
  var form = document.getElementById("bill-form");
  var result = document.getElementById("result");
  var postpaidFields = document.getElementById("postpaid-fields");
  var prepaidFields = document.getElementById("prepaid-fields");
  var usedWrap = document.getElementById("used-wrap");
  var firstOfMonth = document.getElementById("first-of-month");
  var mode = "postpaid";

  function taka(value) {
    return Number(value).toLocaleString("en-BD", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " টাকা";
  }

  function setMode(next) {
    mode = next;
    var postpaid = next === "postpaid";
    document.getElementById("tab-postpaid").classList.toggle("is-on", postpaid);
    document.getElementById("tab-prepaid").classList.toggle("is-on", !postpaid);
    document.getElementById("tab-postpaid").setAttribute("aria-selected", postpaid ? "true" : "false");
    document.getElementById("tab-prepaid").setAttribute("aria-selected", postpaid ? "false" : "true");
    postpaidFields.hidden = !postpaid;
    prepaidFields.hidden = postpaid;
    result.hidden = true;
  }

  function lineRows(lines) {
    return lines.map(function (line) {
      return "<div><span>" + line.label + " · " + line.units + " × " + line.rate.toFixed(2) + "</span><span>" + taka(line.amount) + "</span></div>";
    }).join("");
  }

  function renderPostpaid(bill, distributor) {
    var note = bill.lifelineLost
      ? "<p class=\"note\">৫০ ইউনিটের বেশি হলে লাইফলাইন রেট আর প্রযোজ্য নয়। হিসাব ৫.২৬ টাকা থেকে শুরু হয়েছে।</p>"
      : "";
    result.innerHTML =
      "<h2>" + distributor + " · পোস্টপেইড</h2>" +
      "<div class=\"rows\">" + lineRows(bill.lines) + "</div>" +
      "<div class=\"mini\">" +
        "<div><span>এনার্জি</span><span>" + taka(bill.energy) + "</span></div>" +
        "<div><span>ডিমান্ড চার্জ</span><span>" + taka(bill.demand) + "</span></div>" +
        "<div><span>মিটার ভাড়া</span><span>" + taka(bill.meterRent) + "</span></div>" +
        "<div><span>ভ্যাট ৫%</span><span>" + taka(bill.vat) + "</span></div>" +
      "</div>" +
      "<div class=\"total\"><span>মোট আনুমানিক</span><span>" + taka(bill.total) + "</span></div>" +
      note +
      "<p class=\"hint\">বকেয়া, জরিমানা বা সমন্বয় এই হিসাবে নেই।</p>" +
      "<div class=\"row\"><button type=\"button\" id=\"share\" class=\"ghost\">ফলাফল কপি করুন</button></div>";
    result.hidden = false;
    document.getElementById("share").addEventListener("click", function () {
      copyText(distributor + " পোস্টপেইড আনুমানিক বিল: " + taka(bill.total) + "। এটি অফিসিয়াল বিল নয়।");
    });
  }

  function renderPrepaid(bill, distributor) {
    var short = bill.shortfall
      ? "<p class=\"note\">এই রিচার্জ ডিমান্ড চার্জ, মিটার ভাড়া ও ভ্যাটের চেয়ে " + taka(bill.shortfall) + " কম। ইউনিট ওঠেনি।</p>"
      : "";
    result.innerHTML =
      "<h2>" + distributor + " · প্রিপেইড</h2>" +
      "<div class=\"mini\">" +
        "<div><span>রিচার্জ</span><span>" + taka(bill.recharge) + "</span></div>" +
        "<div><span>ভ্যাট ৫%</span><span>− " + taka(bill.vat) + "</span></div>" +
        "<div><span>ডিমান্ড চার্জ</span><span>− " + taka(bill.demand) + "</span></div>" +
        "<div><span>মিটার ভাড়া</span><span>− " + taka(bill.meterRent) + "</span></div>" +
        "<div><span>ইউনিট কেনার টাকা</span><span>" + taka(bill.energyMoney) + "</span></div>" +
      "</div>" +
      "<div class=\"rows\">" + lineRows(bill.lines) + "</div>" +
      "<div class=\"total\"><span>আনুমানিক ইউনিট</span><span>" + bill.units + "</span></div>" +
      short +
      "<p class=\"hint\">প্রথম রিচার্জে স্থায়ী চার্জ আগে কাটা হয়, তাই ৫০০ টাকার টোকেনে ৫০০ টাকার ইউনিট ওঠে না। ২০২৬ সালের আদেশে প্রিপেইডে নিট চার্জের ওপর ০.৫% রেয়াত আছে। এই টোকেন হিসাবে সেই রেয়াত ধরা হয়নি, তাই আসল ইউনিট সামান্য বেশি হতে পারে।</p>" +
      "<div class=\"row\"><button type=\"button\" id=\"share\" class=\"ghost\">ফলাফল কপি করুন</button></div>";
    result.hidden = false;
    document.getElementById("share").addEventListener("click", function () {
      copyText(distributor + " প্রিপেইড " + taka(bill.recharge) + " রিচার্জে আনুমানিক " + bill.units + " ইউনিট। এটি অফিসিয়াল টোকেন নয়।");
    });
  }

  function copyText(text) {
    var note = document.getElementById("copy-note");
    navigator.clipboard.writeText(text).then(function () {
      note.hidden = false;
    }).catch(function () {
      note.hidden = false;
      note.textContent = text;
    });
  }

  document.getElementById("tab-postpaid").addEventListener("click", function () { setMode("postpaid"); });
  document.getElementById("tab-prepaid").addEventListener("click", function () { setMode("prepaid"); });
  firstOfMonth.addEventListener("change", function () {
    usedWrap.hidden = firstOfMonth.checked;
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var distributor = document.getElementById("distributor").value;
    var common = {
      loadKw: document.getElementById("load").value,
      meterRent: document.getElementById("rent").value,
      lifeline: document.getElementById("lifeline").checked
    };
    if (mode === "postpaid") {
      renderPostpaid(BillCalc.postpaid(Object.assign({ units: document.getElementById("units").value }, common)), distributor);
    } else {
      renderPrepaid(BillCalc.prepaid(Object.assign({
        recharge: document.getElementById("recharge").value,
        firstOfMonth: firstOfMonth.checked,
        usedUnits: document.getElementById("used-units").value
      }, common)), distributor);
    }
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("copy-feedback").addEventListener("click", function () {
    var text = document.getElementById("feedback").value.trim();
    copyText(text || "বিল হিসাবের মতামত: ");
  });

  var status = document.getElementById("rate-status");
  fetch("/api/tariff")
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (!data || !data.ok || !data.latest) {
        status.textContent = "লাইভ যাচাই এখন পাওয়া যায়নি। হিসাব চলছে ৪ জুন ২০২৬-এর যাচাইকৃত রেটে।";
        return;
      }
      if (data.updateAvailable) {
        status.className = "status is-new";
        status.textContent = "ডেসকো নতুন খুচরা আদেশ দিয়েছে (" + data.latest.published + "): " + data.latest.title + "। নতুন পিডিএফের সংখ্যা বসানোর আগে হিসাব ৪ জুন ২০২৬-এর রেটেই থাকবে।";
      } else {
        status.textContent = "ডেসকোর সর্বশেষ খুচরা আদেশ " + data.latest.published + "। এই পাতার রেট সেই আদেশের সাথে মিলছে।";
      }
    })
    .catch(function () {
      status.textContent = "লাইভ যাচাই এখন পাওয়া যায়নি। হিসাব চলছে ৪ জুন ২০২৬-এর যাচাইকৃত রেটে।";
    });
})();
