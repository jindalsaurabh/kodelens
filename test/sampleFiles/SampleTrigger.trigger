trigger SampleTrigger on Account (before insert) {
    for (Account acc : Trigger.new) {
        acc.Description = 'Created by trigger';
    }
}
    